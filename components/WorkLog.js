'use client';

import { useEffect, useRef } from 'react';

const ICON = { info: '·', ok: '✓', cut: '✂', warn: '⚠' };

export default function WorkLog({ entries }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [entries]);

  return (
    <div className="card logCard">
      <div className="logHead">
        <h3>工作日志</h3>
        <span className="mono logCount">{entries.length} 条</span>
      </div>
      <div className="logBody" ref={boxRef}>
        {entries.length === 0 ? (
          <div className="logEmpty">阿桃还没开工。投喂热点（可选）后，点「阿桃，开工」。</div>
        ) : (
          entries.map((e, i) => (
            <div className={`logRow log-${e.type || 'info'}`} key={i}>
              <span className="mono logTime">{e.time}</span>
              <span className="logIcon">{ICON[e.type] || '·'}</span>
              <span className="logText">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
