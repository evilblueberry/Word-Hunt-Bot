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
- Enter your **Device UDID** into the text field. 
  - **How to find UDID:** Open Finder, click on your iPhone under Locations in the sidebar. At the top of the Finder window beneath your device name, click the subtext (which usually shows your battery and storage) multiple times until it displays the "UDID". Right-click and copy this 24-40 character string.

### Step 2: Dependencies, Appium & WebDriverAgent
The app will automatically verify if you have Python, Node, and Appium installed.
- Click **"Install Dependencies"**. The app will create a virtual environment (`venv`) inside the folder and run `pip install` as well as download the Appium XCUITest Driver via NPM.
  - **Note:** If Appium fails to verify automatically after clicking Install, you can install it manually by opening your Mac's Terminal and typing: 
    - `npm install -g appium`
    - `appium driver install xcuitest`

**Xcode & WebDriverAgent (WDA):** 
To control your iPhone remotely, Appium automatically creates a temporary background app called "WebDriverAgent" and installs it via USB. **You DO NOT need to install WebDriverAgent yourself.** 

However, Apple enforces strict security. Apple requires this miniature invisible app to be formally codesigned using a Developer Certificate before it can run on an iPhone.
1. **Xcode:** You **MUST have Xcode installed** on your Mac. You can download it for free from the Mac App Store.
2. **Apple Developer Account:** You **DO NOT** need a paid Apple Developer account. A completely free, normal Apple ID works perfectly! Go to [developer.apple.com/account](https://developer.apple.com/account) and sign in using your normal Apple ID. Accept the free developer program agreements if prompted.
3. **Get Your Team ID:** On the developer website, scroll down to the **Membership details** section. Look for a 10-character alphanumeric string labeled **Team ID** and copy it into the launcher app.
4. **Log Into Xcode:** Open the Xcode application on your Mac. In the top Menu Bar, go to `Xcode -> Settings -> Accounts`. Click the `+` button in the bottom left, select `Apple ID`, and sign in.
5. **Compilation & Trusting:** When you click "Start Bot" for the very first time, it will take 2-4 minutes for Xcode to compile WebDriverAgent in the background. It will then push the app to your phone, but it will instantly crash your game. **This is normal.** Apple prevents apps signed via a free developer certificate from running without manual consent. Open your iPhone, go to `Settings -> General -> VPN & Device Management`, tap your Apple ID email under the "Developer App" section, and click **"Trust"**. You only ever have to do this once.

### Step 3: Use the Dashboard
Once the setup is complete, you will be taken to the Dashboard.
1. Click **"Start Server"** next to Appium. Wait until the indicator turns <span style="color:green">green</span>.
2. Ensure your Word Hunt game is currently visible on the iPhone screen.
3. Click **"Start Bot"**. 
4. The bot will automatically take a screenshot, calculate the paths, and swipe the words on your phone!

## Troubleshooting

- **Signing Errors**: If the Bot crashes with an XCUITest error, usually it means your Team ID is invalid, or you haven't approved the developer certificate on your iPhone. Go to `Settings -> General -> VPN & Device Management` on your phone and click "Trust" on your developer email.
- **Port 4723 in Use**: If Appium fails to start, make sure you don't have another Appium server instance running in the background.
