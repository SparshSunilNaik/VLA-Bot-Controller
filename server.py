from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from controller import RoverController
from ps5_controller import PS5Controller
from datetime import datetime
import os
import threading
import time

# Headless pygame for PS5 controller (no window required)
os.environ["SDL_VIDEODRIVER"] = "dummy"

app = Flask(__name__)
CORS(app)

# ================= STEP CONFIG =================
STEP_DURATION = 0.3   # seconds
current_step_id = 0
step_lock = threading.Lock()

# Initialize Hardware Controller
ctrl = RoverController()

# Initialize PS5 Controller (optional)
ps5 = PS5Controller(ctrl)
ps5.start()

# Log storage for the web UI
logs = []

def add_log(msg):
    t = datetime.now().strftime("%H:%M:%S")
    log_msg = f"[{t}] {msg}"
    logs.append(log_msg)
    if len(logs) > 50:
        logs.pop(0)
    print(log_msg)

# Overwrite controller log function
ctrl.on_log = add_log

@app.route('/')
def index():
    return render_template('index.html')

# ================= STEP EXECUTION =================
def execute_step(action_name):
    global current_step_id
    with step_lock:
        current_step_id += 1
        this_id = current_step_id
    
    print(f"[API] {action_name} requested")
    
    if action_name == "forward":
        ctrl.move_forward()
    elif action_name == "backward":
        ctrl.move_backward()
    elif action_name == "left":
        ctrl.move_right()
    elif action_name =="right":
        ctrl.move_left()
    elif action_name == "stop":
        ctrl.stop()
        return  # No need for delayed stop for 'stop'

    print(f"[MOTOR] running {action_name}")

    def delayed_stop(step_id):
        time.sleep(STEP_DURATION)
        with step_lock:
            if current_step_id == step_id:
                ctrl.stop()
                print(f"[MOTOR] stopped after {STEP_DURATION}s")

    threading.Thread(target=delayed_stop, args=(this_id,), daemon=True).start()

@app.route('/api/forward', methods=['POST'])
def forward():
    execute_step("forward")
    return jsonify({"status": "ok"})

@app.route('/api/backward', methods=['POST'])
def backward():
    execute_step("backward")
    return jsonify({"status": "ok"})

@app.route('/api/left', methods=['POST'])
def left():
    execute_step("left")
    return jsonify({"status": "ok"})

@app.route('/api/right', methods=['POST'])
def right():
    execute_step("right")
    return jsonify({"status": "ok"})

@app.route('/api/stop', methods=['POST'])
def stop():
    execute_step("stop")
    return jsonify({"status": "ok"})

@app.route('/api/move', methods=['POST'])
def move():
    data = request.json
    direction = data.get('direction')
    
    if direction in ['forward', 'backward', 'left', 'right', 'stop']:
        execute_step(direction)
        return jsonify({"status": "ok", "direction": direction})
    else:
        return jsonify({"status": "error", "message": "Invalid direction"}), 400

@app.route('/api/spray', methods=['POST'])
def spray():
    data = request.json
    spray_id = data.get('id')
    
    if spray_id == 1:
        ctrl.manual_spray_blur()
    elif spray_id == 2:
        ctrl.manual_spray_mold()
    elif spray_id == 'stop':
        ctrl.stop()
    else:
        return jsonify({"status": "error", "message": "Invalid spray ID"}), 400
        
    return jsonify({"status": "ok", "spray_id": spray_id})

@app.route('/api/emergency', methods=['POST'])
def emergency():
    ctrl.emergency()
    return jsonify({"status": "ok", "message": "Emergency stop active"})

@app.route('/api/reset', methods=['POST'])
def reset():
    ctrl.clear_emergency()
    return jsonify({"status": "ok", "message": "System reset"})

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        "emergency": ctrl.emergency_active,
        "logs": logs[-20:]
    })

if __name__ == '__main__':
    add_log("Web server starting on port 9999...")
    app.run(host='0.0.0.0', port=9999, debug=False)
