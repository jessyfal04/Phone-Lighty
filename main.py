import asyncio
import ssl
import threading
import websockets
import json
import random
import string

LOCAL_IP = "213.165.83.32"
WS_PORT = 8101

RGB = (0, 0, 0)
listeners = {}
sessionPass = []

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain('/etc/letsencrypt/live/jessyfal04.dev/fullchain.pem', '/etc/letsencrypt/live/jessyfal04.dev/privkey.pem')

sessionCounter = -1
def generate_session():
	global sessionCounter
	sessionCounter += 1
	return sessionCounter

def generate_session_pass():
	return ''.join(random.choices(string.ascii_letters + string.digits, k=10))


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

			print(f"R {websocket.remote_address}: ", message)

			if message['CMD'] == 'SET':
				session = message['ARGS']['SESSION']

				if message['ARGS']['PASS'] == sessionPass[session]:
					RGB = tuple(message['ARGS']['RGB'])
					await send_new_color(session)

			elif message['CMD'] == 'REGISTER':
				session = generate_session()
				listeners[session] = []
				sessionPass.append(generate_session_pass())
				await send(websocket, json.dumps({'CMD': 'SESSION', 'ARGS': {"SESSION": session, "PASS": sessionPass[session]}}))

			elif message['CMD'] == 'LISTEN':
				session = message['ARGS']['SESSION']
				listeners[session].append(websocket)

		except websockets.ConnectionClosed:
			print("F: ", websocket.remote_address)
			break

async def send_new_color(session):
	message = json.dumps({'CMD': 'GET', 'ARGS': {'RGB': RGB}})
	for listener in listeners[session].copy():
		error = await send(listener, message)
		if not error:
			listeners[session].remove(listener)

async def send(websocket, message):
	try:
		print(f"S ({websocket.remote_address}): ", message)
		await websocket.send(message)
		return True
	except:
		print("Listener not reachable")
		return False

if __name__ == '__main__':
	websocketServer_thread = threading.Thread(target=asyncio.run, args=(start_websocket_server(),))
	websocketServer_thread.start()
