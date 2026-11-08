# dsh-restart-plugin

![Platform](https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square)
![DSH plugin](https://img.shields.io/badge/DSH-plugin-4d6bfe?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

> An in-app **force restart** for the DSH (DeepSeek Harness) desktop app: confirm once, and the current app is terminated and relaunched automatically.

[简体中文](README.md) | English

## Overview

`dsh-restart-plugin` is a DSH plugin with both a **host half** and a **web client half**. It adds a restart button to the sidebar footer. After confirmation, a PowerShell helper that lives outside the DSH process tree terminates the current DSH main process and starts the app again from the same executable path.

Useful when:

- a plugin has just been installed, updated, or disabled and DSH needs a full restart;
- a configuration change is only read at startup;
- the UI or a task is stuck and you want a quick restart;
- you do not want to close the window and reopen the app manually.

> **Warning**
>
> This is a **forced restart**. It does not wait for sessions to be saved, and it does not gracefully shut down running tasks. Unsaved session content, running agent tasks, and tool calls may be interrupted.

## Features

- **Sidebar entry**: registered in the `sidebar.footer.action` slot with `order: 10` by default.
- **Adaptive layout**: shows an icon plus the `Restart` label when the sidebar is wide, and only `⟳` when it is collapsed.
- **Confirmation step**: a dialog warns that unsaved content and running tasks will be interrupted.
- **Immediate feedback**: the button becomes disabled and shows `Restarting...` after the request, preventing duplicate clicks.
- **Fast response**: the host returns `200` first and starts the restart asynchronously, so the client does not fail when the connection drops.
- **Detached from the process tree**: WMI creates a hidden PowerShell process that survives the DSH shutdown and can relaunch the app.
- **Self-cleaning**: the temporary PowerShell script deletes itself after execution.
- **No build step**: the source is loaded directly as ESM and a browser module.

## How it works

1. The user clicks the `⟳` button in the sidebar footer and confirms.
2. The client sends `POST /dsh-restart-plugin/force-restart`.
3. The host route immediately returns `200 {"ok":true,"message":"Restarting..."}`.
4. The host writes `dsh-force-restart-<timestamp>.ps1` into the system temporary directory.
5. The host uses WMI `Win32_Process.Create` to launch a hidden PowerShell helper. This process is not part of the DSH process tree.
6. The helper waits 800 ms and looks for a process whose main window title contains `DeepSeek Harness`.
7. When found, it records the executable path, force-stops that process, waits 1 s, and starts the app from the same path.
8. The helper deletes the temporary script; DSH is running again.

```text
Sidebar button
  │ POST /dsh-restart-plugin/force-restart
  ▼
DSH host route ── returns 200 immediately ──▶ client enters Restarting...
  │
  │ WMI (outside the DSH process tree)
  ▼
PowerShell helper
  │ wait 800 ms → stop DSH → wait 1 s
  ▼
start DeepSeek Harness.exe again
```

## Project structure

| File | Purpose |
| --- | --- |
| `package.json` | Package metadata; declares the ESM entry, web client entry, and `dsh.bundle.patch` |
| `index.js` | Host half: registers the force-restart HTTP route and launches the PowerShell helper |
| `client.js` | Web client half: registers the sidebar footer button, confirmation, request, and busy state |
| `cordis.patch.yml` | Bundle patch: inserts the `dsh-restart-plugin` entry into DSH's configuration tree |
| `README.md` / `README-EN.md` | Chinese / English documentation |
| `CHANGELOG.md` | Release history |
| `SECURITY.md` | Security policy and vulnerability reporting |
| `LICENSE` | MIT license |
| `.gitignore` / `.gitattributes` | Git ignore rules and line-ending policy |
| `.github/workflows/ci.yml` | GitHub Actions syntax and package checks |

## Installation

### Requirements

| Item | Requirement |
| --- | --- |
| OS | Windows (uses PowerShell and WMI) |
| App | DSH desktop (DeepSeek Harness) with plugin bundle and web client plugin support |
| DSH capabilities | `webServer` service and `sidebar.footer.action` slot |
| Window title | The DSH main window title must contain `DeepSeek Harness` so the helper can find the process |
| Reference environment | Windows + DeepSeek Harness 0.2.2-rc.1 |

### Install via CLI (recommended)

From GitHub:

```powershell
dsh plugin --profile desktop add github:zhangmaorongXL/dsh-restart-plugin
```

For local development, link this directory instead:

```powershell
dsh plugin --profile desktop add link:E:/path/to/dsh-restart-plugin
```

> `desktop` is the default profile name used by the desktop app. Replace it if you use a custom profile.

Then make sure the profile's `package.json` contains both the dependency and the bundle entry:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-restart-plugin"
      ]
    }
  },
  "dependencies": {
    "dsh-restart-plugin": "github:zhangmaorongXL/dsh-restart-plugin"
  }
}
```

When installing from a local link, use `"link:E:/path/to/dsh-restart-plugin"` as the dependency value.

If `dsh.profile.bundles` does not contain `dsh-restart-plugin`, add it manually. Otherwise `cordis.patch.yml` will not be applied and the plugin will not load.

### Install through a plugin manager

If your DSH version provides a local plugin or bundle install flow, you can also select this directory directly. After installation, make sure the plugin has been added to the profile's bundle list.

### First load

After installing for the first time, **restart DSH manually once**. The restart button has not been loaded yet, so it cannot perform this first restart.

Once the plugin is loaded, the `⟳` button appears at the bottom of the sidebar.

## Usage

1. Find the `⟳` button at the bottom of the DSH sidebar.
2. Click it and confirm the restart.
3. The button changes to `Restarting...` and becomes disabled.
4. DSH is force-stopped and relaunched automatically, usually within a few seconds.
5. If the page has not disconnected before the restart, the button stays in the `Restarting...` state. This is expected; the page reloads with the restarted app.

## HTTP endpoint

### `POST /dsh-restart-plugin/force-restart`

Triggers one force restart. The bundled client uses `POST`. The route is registered by exact path and does not add an extra HTTP method restriction.

Before terminating the process, the host responds once the restart flow has been accepted:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok":true,"message":"Restarting..."}
```

The endpoint has no request body, query parameters, or additional return value. A `200` only means the restart flow was accepted. It does **not** guarantee that the process was stopped or that the app was relaunched successfully.

> The endpoint does not implement separate authentication and relies on the access boundary of the DSH web server. Do not expose DSH's web server to an untrusted network.

## Important behavior and limitations

- **Unsaved work can be lost**: force-stopping the process skips the normal shutdown flow, and running tasks are interrupted.
- **Window title matching**: the helper only handles a process whose main window title contains `DeepSeek Harness`. If the title does not match, the app is not restarted.
- **One process only**: if several candidates match, only the first one is selected.
- **Desktop app only**: in a pure CLI `dsh web` + browser setup there is usually no desktop window titled `DeepSeek Harness`, so this plugin is not suitable for restarting that setup.
- **Permission limits**: if the current user cannot terminate the target process, `Stop-Process` may fail.
- **Security software**: some endpoint protection may block WMI process creation or PowerShell scripts and cause the restart to fail.
- **No configuration options**: the current version does not expose timeouts, title matching rules, or button placement settings.
- **Temporary script leftovers**: the helper deletes itself after execution; if it cannot start, a `dsh-force-restart-*.ps1` file may remain in the temporary directory.

See [SECURITY.md](SECURITY.md) for the security policy and vulnerability reporting process.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| No button in the sidebar | Plugin not loaded, bundle not enabled, or web client not registered | Check `dsh.profile.bundles` and the dependency, restart DSH manually, and check host logs |
| Nothing happens after clicking | No matching window title, or WMI/PowerShell is blocked | Make sure you are using the desktop app and the title contains `DeepSeek Harness`; check security software and WMI |
| App exits but does not come back | Invalid executable path, insufficient permission, or launch blocked | Inspect the temporary script and host logs, then start DSH manually |
| Button stays on `Restarting...` | The app did not actually exit and the page connection is still alive | Close and reopen DSH manually; check for permission or security software blocking the process stop |
| Plugin still unavailable after restart | Bundle not loaded or plugin failed to load | Check startup logs and verify the profile configuration and plugin dependency |

Host-side errors are logged with the `[dsh-restart-plugin]` prefix.

## Development notes

### Host half (`index.js`)

- Uses the Cordis plugin structure and exports `name` and `inject: ['webServer']`.
- Gets the web server inside `apply(ctx)` through `ctx.inject(['webServer'], ...)`.
- Registers an exact route with `webServer.register({ kind: 'exact', path, handler })`.
- Uses `wctx.effect(() => dispose, ...)` to unregister the route when the plugin unloads.
- Launches an outer PowerShell process with `execFile`, then uses WMI to create the detached hidden helper.

### Client half (`client.js`)

- Registers a browser module through `window.__ModuleLoader__.load`.
- Uses the host-provided `react` and `slots` capabilities; React does not need to be bundled separately.
- Registers the button in the `sidebar.footer.action` slot and switches between compact and wide styles using the `wide` prop.
- Treats a failed request as the expected app-termination path and intentionally keeps the busy state.

### Customization points

- Route path: `/dsh-restart-plugin/force-restart` in `index.js`
- Process matching rule: `*DeepSeek Harness*` in the PowerShell script
- Restart delays: `800` and `1000` milliseconds in the script
- Button placement and order: slot name and `order` in `client.js`
- Copy: confirmation dialog and button labels in `client.js`

No build step is required. Reload the plugin or restart DSH after making changes.

## Version

- Current version: `0.1.0`
- Reference environment: Windows + DeepSeek Harness desktop `0.2.2-rc.1`

## License

MIT. See [LICENSE](LICENSE).
