window.__ModuleLoader__.load({
  id: 'dsh-restart-plugin',
  factory: (require) => {
    try {
      const React = require('react');

      function ForceRestartButton({ wide }) {
        const [busy, setBusy] = React.useState(false);

        const handleClick = async () => {
          // 二次确认
          const confirmed = window.confirm(
            '⚠️ 强制重启将立即终止 DSH 应用，所有未保存的会话和正在运行的任务都会被中断。\n\n确定要继续吗？'
          );
          if (!confirmed) return;

          setBusy(true);
          try {
            // 发送请求，宿主端收到后会启动重启脚本
            await fetch('/dsh-restart-plugin/force-restart', { method: 'POST' });
            // 注意：这里不要重置 busy，因为马上应用就会被强杀，保持灰色不可用是合理的表现
          } catch (err) {
            // 应用被强杀时，网络请求可能会断开，这是预期行为，不需要报错
            console.log('[dsh-restart-plugin] App is terminating, waiting for relaunch...');
          }
        };

        const style = {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', height: '32px',
          padding: wide ? '0 14px' : '0',
          width: wide ? 'auto' : '32px',
          borderRadius: '16px',
          border: '1px solid var(--dsw-alias-border, #e5e5e5)',
          background: busy ? 'var(--dsw-alias-bg-hover, rgba(0,0,0,0.04))' : 'var(--dsw-alias-bg-elevated, transparent)',
          color: 'var(--dsw-alias-text-primary, inherit)',
          fontSize: '13px', fontWeight: 500,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
        };

        return React.createElement(
          'button',
          {
            onClick: handleClick,
            disabled: busy,
            title: '强制重启 DSH（所有任务将中断）',
            style,
            onMouseEnter: (e) => { if (!busy) e.currentTarget.style.background = 'var(--dsw-alias-bg-hover, rgba(0,0,0,0.04))'; },
            onMouseLeave: (e) => { if (!busy) e.currentTarget.style.background = style.background; },
          },
          React.createElement('span', { 
            style: { 
              fontSize: '15px', 
              lineHeight: 1,
              display: 'inline-block',
              animation: busy ? 'spin 1s linear infinite' : 'none' 
            } 
          }, '⟳'),
          wide ? React.createElement('span', null, busy ? 'Restarting...' : 'Restart') : null
        );
      }

      return {
        name: 'dsh-restart-plugin',
        inject: ['slots'],
        apply(ctx) {
          ctx.slots.inject('sidebar.footer.action', () => {
            return ctx.slots.register(
              { name: 'sidebar.footer.action', id: 'dsh-restart-plugin', order: 10 },
              ({ wide }) => React.createElement(ForceRestartButton, { wide })
            );
          });
        },
      };
    } catch (err) {
      console.error('[dsh-restart-plugin] Factory execution failed:', err);
      throw err;
    }
  },
});