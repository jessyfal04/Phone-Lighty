var ws;
var sentR;
var sentG;
var sentB;
connect();

function connect() {
	if (ws != null) {
		ws.close();
		ws = null;
	}

	localip = "projects.jessyfal04.dev";
	wsport = "8101";

	if (localip == "" || wsport == "") {
		setMessages("danger", "Please fill all the fields.");
		return;
	}

	// connect to the websocket
	ws = new WebSocket("wss://" + localip + ":" + wsport);
	
	ws.onopen = function() {
		setMessages("success", "Connected to the websocket server.");
	}

	ws.onmessage = function (event) {
		var data = JSON.parse(event.data);

		if (data["cmd"] == "GET")
			setBackground(data["args"]);
	}
}

function send() {
	var interval = 50;

	if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
		setMessages("danger", "getDisplayMedia API is not supported in this browser.");
		return;
	}

	// Choose a screen with API then calculate the average color of the screen inside the interval
	navigator.mediaDevices.getDisplayMedia({ video: true })
		.then(function(stream) {
			const videoTrack = stream.getVideoTracks()[0];
			const imageCapture = new ImageCapture(videoTrack);
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const saturationFactor = 3;

			
			var itn = setInterval(function() {
				imageCapture.grabFrame()
					.then(function(imageBitmap) {
						canvas.width = imageBitmap.width;
						canvas.height = imageBitmap.height;
						ctx.drawImage(imageBitmap, 0, 0);
						const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
						const pixelData = imageData.data;

						let r = 0, g = 0, b = 0;
						for (let i = 0; i < pixelData.length; i += 4) {
							r += pixelData[i];
							g += pixelData[i + 1];
							b += pixelData[i + 2];
						}
						const numPixels = pixelData.length / 4;
						const avgR = Math.round(r / numPixels);
						const avgG = Math.round(g / numPixels);
						const avgB = Math.round(b / numPixels);
						
						// distance formula avg (r g b) and sent (r g b)

						var distance = Math.sqrt(Math.pow(avgR - sentR, 2) + Math.pow(avgG - sentG, 2) + Math.pow(avgB - sentB, 2));
						if (distance < 15) return;

						sentR = avgR;
						sentG = avgG;
						sentB = avgB;

						console.log("Distance: " + distance);
						console.log("RGB: " + avgR + ", " + avgG + ", " + avgB + " | " + saturationFactor + ", " + saturateRgb(avgR, avgG, avgB, saturationFactor));

						
						ws.send(JSON.stringify({ cmd: "SET", args: saturateRgb(avgR, avgG, avgB, saturationFactor) }));
						if (ws.readyState != 1) {
							setMessages("danger", "Disconnected from the websocket server.");
							clearInterval(itn);
						}

						setTimeout(function() {}, 300);
					})
					.catch(function(error) {
						// setMessages("warning", "Error grabbing frame.");
						// clearInterval(itn);
					});
			}, interval);
		})
		.catch(function(error) {
			setMessages("danger", "Error accessing screen.");
		});
}

//
async function receive() {
	ws.send('{"cmd":"LISTEN"}');

	// use fullbright phone

	await requestWakeLock();
	document.documentElement.requestFullscreen();
	$("body").children().css("display", "none");
	$("body").css("height", "100vh");
	$("body").css("width", "100vw");
}

function setBackground (args) {
	$("body").css("background-color", "rgb(" + args[0] + "," + args[1] + "," + args[2] + ")");

	// gradient background change

}

function setMessages(type, text) {
	$("#messages").html("");
	// in click one 
	if (text != null) {
        var notification = $(`
            <div class="notification is-${type} mx-6" style="display: none;">
				<button class="delete" onclick="$(this).parent().remove();"></button>
				${text}
            </div>
        `);
        
        // Append notification to messages container
        $("#messages").append(notification);

        // Fade in the notification
        notification.fadeIn();

        // Set timeout to fade out and remove the notification after 5 seconds
        setTimeout(function() {
            notification.fadeOut(function() {
                $(this).remove();
            });
        }, 5000);
    }
}

//

// Function to convert RGB to HSL
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

// Function to convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Function to saturate RGB
function saturateRgb(r, g, b, saturationFactor) {
    let [h, s, l] = rgbToHsl(r, g, b);
    s *= saturationFactor; // increase saturation by the factor
    s = Math.min(1, s); // ensure the saturation does not exceed 1
    return hslToRgb(h, s, l);
}

let wakeLock = null;

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock is active');
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock has been released');
    }
}
