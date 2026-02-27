# First-Time Setup Guide for Word Hunt Bot Launcher

Welcome to the **Word Hunt Bot**! This launcher packages the automation scripts into a beautiful, native desktop app (macOS/Windows) and orchestrates the Appium and WebDriverAgent background processes for you.

## Getting Started

1. **Download the App**: Go to the GitHub Releases page and simply download the **.dmg** (macOS) or **.exe** (Windows).
2. **Launch**: Open the downloaded application.

> [!WARNING]
> Because you are installing a custom automation app to an iOS device, Apple requires Developer mode and Code Signing. The Launcher will guide you through this process, but you MUST provide a valid Apple Developer Team ID.

## The Setup Wizard

When you open the App for the first time, you will be greeted with a Setup Wizard. Follow these steps:

### Step 1: Connect your Device
- Connect your iPhone to your Mac via USB.
- On your iPhone, if prompted, click **"Trust This Computer"**.
- Go to `Settings -> Privacy & Security -> Developer Mode` and toggle it ON.
- Enter your **Device UDID** into the text field (you can find this easily in Finder when the phone is connected).

### Step 2: Dependencies
The app will automatically verify if you have Python, Node, and Appium installed.
- Click **"Install Python Requirements"**. The app will create a virtual environment (`venv`) inside the folder and run `pip install -r requirements.txt`. It uses its own bundled requirements so it won't conflict with your system Python.
- Provide your **Apple Team ID**. Appium requires this to sign the `WebDriverAgentRunner` application that gets installed onto your phone. You can find this 10-character string in your Apple Developer account (`Account -> Membership details`).

### Step 3: Use the Dashboard
Once the setup is complete, you will be taken to the Dashboard.
1. Click **"Start Server"** next to Appium. Wait until the indicator turns <span style="color:green">green</span>.
2. Ensure your Word Hunt game is currently visible on the iPhone screen.
3. Click **"Start Bot"**. 
4. The bot will automatically take a screenshot, calculate the paths, and swipe the words on your phone!

## Troubleshooting

- **Signing Errors**: If the Bot crashes with an XCUITest error, usually it means your Team ID is invalid, or you haven't approved the developer certificate on your iPhone. Go to `Settings -> General -> VPN & Device Management` on your phone and click "Trust" on your developer email.
- **Port 4723 in Use**: If Appium fails to start, make sure you don't have another Appium server instance running in the background.
