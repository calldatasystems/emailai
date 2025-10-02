# Connecting to Vast.ai with PuTTY (Windows)

Complete guide to configure PuTTY for connecting to your Vast.ai GPU instance.

---

## Understanding Vast.ai SSH Connection String

Vast.ai provides SSH connection in this format:

```
ssh root@ssh5.vast.ai -p 12345
```

Breaking it down:
- **Username**: `root`
- **Hostname**: `ssh5.vast.ai` (or ssh4.vast.ai, ssh6.vast.ai, etc.)
- **Port**: `12345` (unique to your instance)

---

## Quick Setup (5 Steps)

### Step 1: Get Your SSH Connection Details

1. Go to https://vast.ai
2. Find your running instance
3. Copy the SSH connection string
   - Example: `ssh root@ssh5.vast.ai -p 12345`

### Step 2: Download PuTTY

If you don't have PuTTY:

1. Download from: https://www.putty.org/
2. Get **putty.exe** (standalone) or the full installer
3. No installation needed for standalone version

### Step 3: Configure PuTTY Session

1. **Open PuTTY**

2. **Basic Settings** (Session category):
   ```
   Host Name (or IP address): ssh5.vast.ai
   Port: 12345
   Connection type: SSH
   ```

   ![PuTTY Session Screenshot](https://i.imgur.com/example.png)

3. **Configure Auto-login** (Connection → Data):
   ```
   Auto-login username: root
   ```

4. **Save the Session**:
   ```
   Saved Sessions: Vast.ai Ollama Server
   Click "Save"
   ```

### Step 4: Connect

1. **Double-click** the saved session OR
2. **Click "Open"**

3. **First connection warning**:
   - Click "Yes" to trust the host key
   - This is normal for first connection

4. **Enter password** when prompted
   - Get password from Vast.ai dashboard
   - Or use SSH key (see below)

### Step 5: You're Connected!

```bash
root@vast:~#
```

You should now see the command prompt. You can now:
- Install Claude Code
- Setup Ollama
- Work with the server

---

## Detailed PuTTY Configuration

### Session Settings

```
Category: Session

Host Name: ssh5.vast.ai
Port: 12345
Connection type: SSH

Saved Sessions: Vast.ai Ollama Server

[ Save ]  [ Load ]  [ Delete ]
```

**Important**: Replace `ssh5.vast.ai` and `12345` with your actual values from Vast.ai!

### Connection Settings

```
Category: Connection

Seconds between keepalives: 30
Enable TCP keepalives: ✓
```

This prevents the connection from timing out.

### Data Settings

```
Category: Connection → Data

Auto-login username: root
```

This auto-fills the username so you don't have to type it each time.

### SSH Settings (Optional - For Better Performance)

```
Category: Connection → SSH

Preferred SSH protocol version: 2

Encryption options:
  Enable compression: ✓
```

---

## Using SSH Keys (Recommended for Security)

### Generate SSH Key Pair

**Option A: Using PuTTYgen**

1. **Download PuTTYgen**: https://www.putty.org/
2. **Run PuTTYgen**
3. **Generate key**:
   - Type of key: RSA
   - Number of bits: 2048 or 4096
   - Click "Generate"
   - Move mouse randomly to generate randomness
4. **Save keys**:
   - Private key: Save as `vastai-ollama.ppk`
   - Public key: Copy the text in "Public key for pasting..."

**Option B: Using OpenSSH (Windows 10/11)**

1. **Open PowerShell**:
   ```powershell
   ssh-keygen -t ed25519 -C "vastai-ollama"
   ```

2. **Save to**: `C:\Users\YourName\.ssh\id_ed25519`

3. **Convert to PuTTY format**:
   - Open PuTTYgen
   - Conversions → Import key
   - Select `id_ed25519`
   - Save private key as `.ppk`

### Add Public Key to Vast.ai

1. **Get your public key**:
   - PuTTYgen: Copy from the text box
   - OpenSSH: `cat ~/.ssh/id_ed25519.pub`

2. **Add to Vast.ai instance**:

   **Method 1: Via Vast.ai Dashboard**
   - Go to instance settings
   - Add SSH public key
   - Paste your public key

   **Method 2: Manually on server** (using password first time)
   ```bash
   # SSH with password
   # Then run:
   mkdir -p ~/.ssh
   echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   ```

### Configure PuTTY to Use SSH Key

```
Category: Connection → SSH → Auth

Private key file for authentication:
  [ Browse... ]
  Select: vastai-ollama.ppk
```

Now you can connect without password!

---

## Saving Connection as Desktop Shortcut

1. **Create shortcut**:
   - Right-click PuTTY.exe → Send to → Desktop (create shortcut)

2. **Edit shortcut properties**:
   ```
   Target: "C:\Path\to\putty.exe" -load "Vast.ai Ollama Server"
   ```

3. **Rename shortcut**: "Vast.ai Ollama Server"

Now you can double-click the desktop icon to connect instantly!

---

## Common PuTTY Issues & Solutions

### Issue 1: "Network error: Connection refused"

**Cause**: Wrong hostname or port

**Solution**: Double-check connection details from Vast.ai dashboard
```
Vast.ai Dashboard → Instances → Copy SSH command
ssh root@ssh5.vast.ai -p 12345
        ↓             ↓
    hostname        port
```

### Issue 2: "Network error: Connection timed out"

**Cause**:
- Instance might be paused
- Firewall blocking connection
- Instance being destroyed

**Solution**:
1. Check instance status on Vast.ai dashboard
2. Restart instance if paused
3. Check Windows Firewall settings
4. Try different network (not corporate firewall)

### Issue 3: "Access denied" or "Permission denied"

**Cause**: Wrong username or password/key

**Solution**:
1. Username should be `root`
2. Get password from Vast.ai dashboard
3. If using SSH key, verify it's the correct private key

### Issue 4: "Host key verification failed"

**Cause**: Host key changed (instance was recreated)

**Solution**:
1. In PuTTY: Click "Yes" to accept new key
2. Or delete old host key:
   - Registry: `HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\SshHostKeys`
   - Find and delete the old `ssh5.vast.ai` entry

### Issue 5: Connection drops after idle time

**Cause**: No keepalive packets

**Solution**: Enable keepalives in PuTTY
```
Connection → Seconds between keepalives: 30
Connection → Enable TCP keepalives: ✓
```

### Issue 6: Screen clears/scrolls weirdly

**Cause**: Terminal settings

**Solution**:
```
Window → Columns: 100
Window → Rows: 40
Window → Lines of scrollback: 2000
Terminal → Implicit CR in every LF: ✓
```

---

## Using Multiple Vast.ai Instances

If you have multiple Vast.ai servers:

### Save Multiple Sessions

```
Session 1:
  Name: Vast.ai Ollama Prod
  Host: ssh5.vast.ai
  Port: 12345

Session 2:
  Name: Vast.ai Ollama Dev
  Host: ssh4.vast.ai
  Port: 54321
```

### Use Session Manager

1. **Install PuTTY Session Manager**: https://puttysm.sourceforge.io/
2. **Organize sessions** in folders
3. **One-click connections**

---

## Advanced: Port Forwarding

To access Ollama from your local machine:

### Configure Tunnel in PuTTY

```
Category: Connection → SSH → Tunnels

Source port: 11434
Destination: localhost:11434
Type: Local

[ Add ]
```

Now Ollama on Vast.ai is accessible at `http://localhost:11434` on your Windows machine!

**Test it**:
```powershell
# In PowerShell
curl http://localhost:11434/api/tags
```

---

## Installing Claude Code via PuTTY

Once connected via PuTTY:

```bash
# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Start Claude Code
claude
```

📖 See [VASTAI_CLAUDE_SETUP.md](./VASTAI_CLAUDE_SETUP.md) for complete guide.

---

## Recommended PuTTY Settings

### Window Settings

```
Category: Window

Columns: 120
Rows: 40
Lines of scrollback: 10000

Appearance:
  Font: Consolas, 10-point
  or: Cascadia Code, 10-point
```

### Colors (Optional - Dark Theme)

```
Category: Window → Colours

ANSI Black: 0, 0, 0
ANSI Red: 205, 49, 49
ANSI Green: 13, 188, 121
ANSI Yellow: 229, 229, 16
ANSI Blue: 36, 114, 200
ANSI Magenta: 188, 63, 188
ANSI Cyan: 17, 168, 205
ANSI White: 229, 229, 229

Default Foreground: 229, 229, 229
Default Background: 0, 0, 0
```

### Translation (For UTF-8)

```
Category: Window → Translation

Remote character set: UTF-8
```

---

## Using PuTTY with Screen/tmux

To keep sessions alive when PuTTY disconnects:

```bash
# Install screen
apt install -y screen

# Start screen session
screen -S ollama

# Work in screen
claude
# (setup Ollama, etc.)

# Detach from screen: Ctrl+A, then D
# Close PuTTY (screen keeps running!)

# Next time, reconnect PuTTY and:
screen -r ollama
# Your session is still there!
```

---

## Alternative: Windows Terminal + OpenSSH

If you prefer modern terminal:

### Install Windows Terminal

From Microsoft Store: https://aka.ms/terminal

### Create SSH Profile

Add to Windows Terminal settings:

```json
{
  "name": "Vast.ai Ollama",
  "commandline": "ssh root@ssh5.vast.ai -p 12345",
  "icon": "🖥️"
}
```

Now you can connect via Windows Terminal dropdown!

---

## Quick Reference

### PuTTY Connection Template

```
Host Name: ssh5.vast.ai      (from Vast.ai dashboard)
Port: 12345                   (from Vast.ai dashboard)
Connection type: SSH
Auto-login username: root

Save as: Vast.ai Ollama Server
```

### Essential Commands After Connection

```bash
# Update system
apt update && apt upgrade -y

# Install Claude Code
curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh

# Start Claude Code
claude

# Clone EmailAI
git clone https://github.com/calldatasystems/emailai.git
cd emailai

# Setup Ollama
# (Ask Claude to run: ollama-server/scripts/setup.sh)
```

---

## Troubleshooting Checklist

- [ ] **Correct hostname from Vast.ai dashboard**
- [ ] **Correct port number from Vast.ai dashboard**
- [ ] **Username is "root"**
- [ ] **Instance is running (not paused)**
- [ ] **Firewall allows outbound SSH (port 22)**
- [ ] **If using key: correct .ppk file loaded**
- [ ] **Keepalives enabled (30 seconds)**
- [ ] **Session saved for future use**

---

## Getting Help

### PuTTY Issues
- PuTTY FAQ: https://www.chiark.greenend.org.uk/~sgtatham/putty/faq.html
- PuTTY Manual: https://the.earth.li/~sgtatham/putty/latest/htmldoc/

### Vast.ai Issues
- Vast.ai Documentation: https://vast.ai/docs
- Vast.ai Support: https://vast.ai/console/support

### SSH Connection String Examples

Different formats you might see:

```bash
# Standard format (most common)
ssh root@ssh5.vast.ai -p 12345

# With identity file
ssh -i ~/.ssh/vastai_key root@ssh5.vast.ai -p 12345

# Full verbose format
ssh -v -p 12345 root@ssh5.vast.ai

# For PuTTY, you need:
Hostname: ssh5.vast.ai
Port: 12345
Username: root
```

---

## Next Steps After Connecting

Once you're successfully connected via PuTTY:

1. **Install Claude Code** (see above)
2. **Clone EmailAI repository**
3. **Setup Ollama** with Claude's help
4. **Configure for EmailAI** production use
5. **Test the API endpoint**

📖 Complete guides:
- [VASTAI_CLAUDE_SETUP.md](./VASTAI_CLAUDE_SETUP.md) - Install Claude Code
- [VASTAI_DEPLOYMENT.md](./VASTAI_DEPLOYMENT.md) - Full Ollama deployment
- [README.md](../README.md) - Ollama overview

---

**Ready to connect?**

1. Open PuTTY
2. Enter hostname and port from Vast.ai
3. Username: `root`
4. Click "Open"
5. Enter password
6. You're in! 🚀
