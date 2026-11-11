# Setting up SETU

## 1. EasyEDA Pro

1. Install the **EasyEDA Pro desktop app** (easyeda.com or lceda.cn).
2. Open **Extensions → Extension Manager** (or the extension store) and install
   **Run API Gateway** — https://jlc-ext.com/item/oshwhub/run-api-gateway.
3. In the Extension Manager, enable it and turn on **Allow external interaction** for it.
4. Keep EasyEDA Pro open with your project while you work with Claude. The extension connects by
   itself to SETU on 127.0.0.1 (ports 49620–49629).

## 2. Claude

You need **Node.js 18 or newer** (nodejs.org); the plugin uses it to start the server.

**Claude desktop app:** Customize → Plugins → Add → Add marketplace →
`https://github.com/NextBuilder/Setu` → install **SETU**. Start a new chat.

**Claude Code:**

```
/plugin marketplace add NextBuilder/Setu
/plugin install setu@next-builder-setu
```

The first time the plugin starts, it downloads SETU's server for your computer from the
GitHub release with the same version and keeps it in:

| System | Folder |
|---|---|
| Windows | `%LOCALAPPDATA%\SETU\<version>\setu.exe` |
| macOS, Linux | `~/.local/share/setu/<version>/setu` |

To use a copy you built or downloaded yourself, set the environment variable `SETU_BIN` to its
full path.

## 3. Check the connection

Ask Claude: *"Check the SETU connection."* It calls `setu_status`, which lists the connected
EasyEDA windows and the open project.

| You see | Fix |
|---|---|
| No EasyEDA window is connected | EasyEDA Pro is closed, the extension is disabled, or external interaction is off. Enable it and reload the extension |
| Two windows | Tell Claude which one; it calls `select_window` |
| A tool fails with an EasyEDA API error | Update EasyEDA Pro; Claude can still do the step with `run_script` |
| SETU Setup tool only | The server could not be downloaded; download it from the releases page and set `SETU_BIN` |

## 4. Updating

Update the plugin in Claude (Customize → Plugins → SETU → Update, or
`/plugin marketplace update next-builder-setu` in Claude Code) and start a new chat. The new
version downloads its matching server on first start; older server folders can be deleted.

## 5. Working with other EasyEDA tools

SETU uses the same local bridge protocol as EasyEDA's own API skill. If another bridge is already
running on those ports, SETU shares it instead of starting its own.
