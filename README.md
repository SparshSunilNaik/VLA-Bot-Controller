# 🌿 Rover Remote Control System

A high-performance Raspberry Pi-based rover control system featuring a premium web interface, step-based movement, and parallel PS5 controller support.

---

## 🚀 Quick Start

Ensure you are in the project root and then run the remote control server:

```bash
cd /home/carrugv/plant_disease_rover
./rover_env/bin/python3 server.py
```

*   **Access Web UI**: `http://<YOUR_PI_IP>:9999`
*   **Default Port**: 9999

---

## 🛠️ Key Features

### 1. **Step-Based Movement**
*   Designed for precise control. Each click sends a motor command for a fixed duration (**0.3s** default) before automatically stopping.
*   Non-blocking threading allows for rapid command execution (e.g., Forward → Left → Forward) with smooth preemption.

### 2. **Premium Web Interface**
*   **Modern Design**: Glassmorphism aesthetic with a dark-mode theme.
*   **Mode Selector**: 
    *   **Manual Mode**: Full UI interaction enabled.
    *   **Autonomous Mode**: Disables UI movement buttons to allow for programmatic control via API with no human interference.
*   **Real-time Logs**: Live monitoring of movement, emergency states, and system resets directly in the browser.

### 3. **Hardware & Safety**
*   **Motor Driver**: Configured for L298N controlling two DC motors.
*   **Emergency Stop**: Hardware-integrated stop that immediately halts all motors and locks movement until reset.
*   **Safety Lockout**: Prevents motor commands during an active emergency state.

### 4. **PS5 Controller Support**
*   Plug-and-play support for PS5 controllers.
*   Functions in parallel with the web interface.
*   **Headless Operation**: Runs automatically as a background thread in the web server.

---

## 📡 API Reference

The server exposes clean REST endpoints for remote programmatic control. All endpoints use `POST`.

| Endpoint | Action |
| :--- | :--- |
| `/api/forward` | Move forward for `STEP_DURATION` |
| `/api/backward` | Move backward for `STEP_DURATION` |
| `/api/left` | Turn left for `STEP_DURATION` |
| `/api/right` | Turn right for `STEP_DURATION` |
| `/api/stop` | Immediately stop all motors and cancel pending steps |
| `/api/emergency` | Trigger full system emergency stop |
| `/api/reset` | Clear emergency stop and re-arm system |
| `/api/status` | Get JSON status (Emergency state, Recent Logs) |

---

## 🏗️ Project Structure

```text
├── server.py           # Flask Backend & Control Hub
├── controller.py       # Hardware Abstraction (GPIOZero)
├── ps5_controller.py   # PS5 Input Threading
├── templates/
│   └── index.html      # UI Structure
├── static/
│   ├── style.css       # Premium Design Tokens
│   └── script.js       # Client-side API Logic
├── requirements.txt    # Project Dependencies
└── commands.txt        # Command Cheat Sheet
```

---

## ⚙️ Configuration

You can tune the movement behavior in `server.py`:

```python
# server.py
STEP_DURATION = 0.3   # seconds per move command
```

---

## 🔧 Installation

To recreate the environment:

1.  **Create Virtual Environment**:
    ```bash
    python3 -m venv rover_env
    ```
2.  **Install Dependencies**:
    ```bash
    ./rover_env/bin/pip install -r requirements.txt
    ```

---

*Developed for the Google Deepmind Advanced Agentic Coding Team.*
