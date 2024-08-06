import asyncio
import ssl
import threading
import websockets
import json

LOCAL_IP = "213.165.83.32"
WS_PORT = 8101

RGB = (0, 0, 0)
listeners = []
sendTimeout = 1
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain('/etc/letsencrypt/live/projects.jessyfal04.dev/fullchain.pem', '/etc/letsencrypt/live/projects.jessyfal04.dev/privkey.pem')

async def start_websocket_server():
	async with websockets.serve(handle_websocket, LOCAL_IP, WS_PORT, ssl=ssl_context):
		print("WebSocket server started at wss://" + LOCAL_IP + ":" + str(WS_PORT))
		await asyncio.Future()  # Keep the server running

async def handle_websocket(websocket, path):
	global RGB
	print("O: ", websocket.remote_address)

	while True:
		try:
			data = await websocket.recv()
			message = json.loads(data)
			print(f"R ({websocket.remote_address}): ", message)
			if message['cmd'] == 'SET':
				RGB = tuple(message['args'])
				await send_new_color()

			elif message['cmd'] == 'LISTEN':
				listeners.append(websocket)

		except websockets.ConnectionClosed:
			print("F: ", websocket.remote_address)
			break	

async def send_new_color():
	message = json.dumps({'cmd': 'GET', 'args': RGB})
	for listener in listeners.copy():
		await send(listener, message)

async def send(websocket, message):
	print(f"S ({websocket.remote_address}): ", message)
	try:
		await websocket.send(message)
	except websockets.ConnectionClosed:
		listeners.remove(websocket)
		print("Connection closed while sending message")

if __name__ == '__main__':
	websocketServer_thread = threading.Thread(target=asyncio.run, args=(start_websocket_server(),))
	websocketServer_thread.start()