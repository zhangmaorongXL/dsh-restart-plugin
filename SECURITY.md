# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Use **Security → Advisories → Report a vulnerability** on this repository to send a private report to the maintainer. If private reporting is unavailable, open a minimal issue asking for a private contact channel without including exploit details.

Please include:

- the affected version and DSH version;
- steps to reproduce;
- the expected and actual impact;
- any relevant logs, with secrets removed.

## Security model and known risks

- **Unauthenticated local endpoint.** `POST /dsh-restart-plugin/force-restart` has no separate authentication or CSRF protection. It relies on the access boundary of the DSH web server. Do not expose DSH's web server to an untrusted network.
- **Force termination.** The plugin intentionally terminates the DSH main process. Unsaved sessions and running tasks can be lost.
- **PowerShell and WMI.** The host writes a temporary `.ps1` file and launches it through WMI `Win32_Process.Create` so the helper survives the DSH process exit. The plugin runs with the same privileges as DSH. Review the source before installing a build from an untrusted source.
- **Window title matching.** The helper terminates the first process whose main window title contains `DeepSeek Harness`. Renaming or spoofing that window title could cause the wrong process to be stopped.
- **No privilege escalation.** The plugin does not attempt to elevate privileges. If DSH runs with higher privileges, the restart helper may be unable to stop or relaunch it.
