import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const name = 'dsh-restart-plugin';
export const inject = ['webServer'];

export function apply(ctx) {
  // 注意：所有用到 ctx 的代码都必须严格包含在 apply 函数内部
  ctx.inject(['webServer'], (wctx) => {
    const webServer = wctx.get('webServer');
    if (!webServer) return;

    const dispose = webServer.register({
      kind: 'exact',
      path: '/dsh-restart-plugin/force-restart',
      handler: async (req, res) => {
        // 1. 立即返回成功，让前端进入 loading 状态，避免前端因连接断开而报错
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, message: 'Restarting...' }));

        try {
          // 2. 创建一个临时 PowerShell 脚本
          const scriptPath = path.join(os.tmpdir(), `dsh-force-restart-${Date.now()}.ps1`);
          const psContent = `
            Start-Sleep -Milliseconds 800
            # 寻找带有 DeepSeek Harness 窗口的主进程
            $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*DeepSeek Harness*" } | Select-Object -First 1
            if ($proc) {
              $exePath = $proc.Path
              # 强制结束主进程（连带子进程）
              Stop-Process -Id $proc.Id -Force
              Start-Sleep -Milliseconds 1000
              # 重新启动应用
              Start-Process -FilePath $exePath
            }
            # 脚本执行完毕后删除自己
            Remove-Item -Path $PSCommandPath -Force
          `;
          fs.writeFileSync(scriptPath, psContent, 'utf8');

          // 3. 使用 WMI 启动 PowerShell 脚本。
          // WMI 创建的子进程不受当前 DSH 进程树生命周期的约束，因此宿主被 kill 后它依然能存活并拉起新进程。
          // 外层调用器用 windowsHide + -WindowStyle Hidden 隐藏；
          // 内层重启脚本用 Win32_ProcessStartup.ShowWindow = 0 从进程创建阶段隐藏控制台。
          const childCmd = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${scriptPath}"`;
          const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;
          const wmiScript = [
            `$childCmd = ${psQuote(childCmd)}`,
            `$startup = ([WmiClass]'Win32_ProcessStartup').CreateInstance()`,
            `$startup.ShowWindow = 0`,
            `$result = Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList @($childCmd, $null, $startup)`,
            `if ($result.ReturnValue -ne 0) { exit $result.ReturnValue }`,
          ].join('\r\n');

          const encoded = Buffer.from(wmiScript, 'utf16le').toString('base64');

          execFile('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-WindowStyle', 'Hidden',
            '-EncodedCommand', encoded,
          ], { windowsHide: true }, (err) => {
            if (err) console.error('[dsh-restart-plugin] WMI launch failed:', err);
          });
        } catch (e) {
          console.error('[dsh-restart-plugin] restart failed', e);
        }
      },
    });

    wctx.effect(() => dispose, 'dsh-restart-plugin: force restart route');
  });
}