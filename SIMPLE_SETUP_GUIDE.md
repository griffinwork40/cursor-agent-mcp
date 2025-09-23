# 🚀 Simple Setup Guide: Using Cursor MCP with Claude Desktop

This guide will help you connect Claude Desktop to Cursor's AI agents so Claude can create and manage coding projects for you automatically.

## What You'll Need

- **Your MCP client app** (this guide demonstrates using Claude Desktop, but you can adapt it for any compatible MCP client)
- **Cursor subscription** (this only works if you have a paid Cursor plan)
- **5 minutes** of your time

---

## Step 1: Get Your Cursor API Key

1. **Open your web browser** and go to [cursor.com/dashboard](https://cursor.com/dashboard)

2. **Sign in** to your Cursor account (the same one you use for the Cursor app)

3. **Click on "Background Agents"** in the left sidebar

4. **Click "Create New API Key"** 
   - Give it a name like "Claude Desktop"
   - Click "Create"

5. **Copy the API key** that appears (it starts with "key_")
   - ⚠️ **Important**: Save this somewhere safe! You won't be able to see it again

---

## Step 2: Find Your Claude Desktop Configuration File

### On Mac:
1. **Open the Claude Desktop app**
2. **Go to** `Settings` (Menu Bar)
3. **Click on** `Developer`
4. **Select** `Edit Config`
5. This will open the `claude_desktop_config.json` file in your default text editor
   - If the file doesn't exist, the app will create it for you when you click `Edit Config`

---

## Step 3: Update the Configuration File

1. **Open** the `claude_desktop_config.json` file in any text editor (like Notepad, TextEdit, or VS Code)

2. **Replace everything** in the file with this code:

```json
{
  "mcpServers": {
    "cursor-background-agents": {
      "command": "npx",
      "args": ["cursor-agent-mcp@latest"],
      "env": {
        "CURSOR_API_KEY": "PASTE_YOUR_API_KEY_HERE",
        "CURSOR_API_URL": "https://api.cursor.com"
      }
    }
  }
}
```

3. **Replace** `PASTE_YOUR_API_KEY_HERE` with the API key you copied from Step 1
   - Make sure to keep the quotes around it
   - It should look like: `"CURSOR_API_KEY": "key_abc123..."`

4. **Save** the file

---

## Step 4: Restart Claude Desktop

1. **Completely close** Claude Desktop (make sure it's not running in the background)
2. **Open** Claude Desktop again
3. **Wait** about 10-15 seconds for everything to load

---

## Step 5: Test It Out!

1. **Start a new conversation** in Claude Desktop

2. **Try asking Claude** something like:
   ```
   "Can you create a background agent to help me build a simple todo app in React?"
   ```

3. **If it works**, Claude should be able to:
   - List your GitHub repositories
   - Create background agents
   - Monitor their progress
   - Show you the results

---

## 🎉 You're All Set!

If everything worked, you should now be able to ask Claude to:

- **Create coding projects** for you automatically
- **Fix bugs** in your existing code
- **Add new features** to your apps
- **Write tests** and documentation
- **And much more!**

---

## 🚨 Troubleshooting

### "I don't see any special abilities in Claude"
- Make sure you **restarted Claude Desktop** completely
- Check that your **API key is correct** (no extra spaces or characters)
- Verify you have a **Cursor subscription** (free accounts won't work)

### "Claude says it can't access Cursor"
- Double-check your **API key** is valid
- Make sure you **saved the config file** properly
- Try **restarting Claude Desktop** again

### "The config file won't save"
- Make sure the file is named **exactly** `claude_desktop_config.json`
- Check you have **permission** to save files in that folder
- Try using a different text editor

### "I get an error about npx or node"
- This usually means the system is downloading the required files
- **Wait a few minutes** and try again
- Make sure you have an **internet connection**

---

## 🔒 Important Notes

- **Keep your API key secret** - don't share it with anyone
- **This only works with paid Cursor subscriptions** - free accounts won't work
- **Background agents use your Cursor credits** - monitor your usage
- **Always restart Claude Desktop** after changing the config file

---

## 💡 What Can You Do Now?

Ask Claude things like:

- *"Create a background agent to build me a weather app"*
- *"Fix all the TypeScript errors in my project"*
- *"Add a dark mode to my website"*
- *"Write unit tests for my React components"*
- *"Optimize the performance of my app"*

The possibilities are endless! 🚀

---

**Need help?** Feel free to ask Claude for assistance - it can now help you create and manage your coding projects automatically!
