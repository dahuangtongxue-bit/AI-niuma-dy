'use client';

import { useEffect, useState, useRef } from 'react';
import EmployeeCard from './EmployeeCard';
import DnaBar from './DnaBar';
import WorkLog from './WorkLog';
import ScriptCard from './ScriptCard';
import FeedPanel from './FeedPanel';
import AssetsStudio from './AssetsStudio';
import { runProduction } from '@/lib/pipeline';

const todayKey = () => {
  const d = new Date();
  return `dy-delivery:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Workbench({ profile, onRetrain }) {
  const [mode, setMode] = useState('assets');
  const [hot, setHot] = useState('');
  const [status, setStatus] = useState('idle');
  const stopRef = useRef({ stop: false });
  const [logs, setLogs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey());
      if (saved) {
        const data = JSON.parse(saved);
        setNotes(data.notes || []);
        setLogs(data.logs || []);
        if ((data.notes || []).length > 0) setStatus('done');
      }
    } catch (e) { /* 忽略坏数据 */ }
  }, []);

  function stopWork() { stopRef.current.stop = true; }

  async function run(extra) {
    stopRef.current = { stop: false };
    setStatus('working');
    setError('');
    setNotes([]);
    const collected = { logs: [], notes: [] };
    setLogs([]);
    try {
      await runProduction({
        profile,
        hot: hot.trim(),
        shouldStop: () => stopRef.current.stop,
        ...extra,
        onLog: (entry) => { collected.logs.push(entry); setLogs((prev) => [...prev, entry]); },
        onNote: (note) => { collected.notes.push(note); setNotes((prev) => [...prev, note].sort((a, b) => a.id - b.id)); },
      });
      setStatus('done');
      try { localStorage.setItem(todayKey(), JSON.stringify(collected, (k, v) => ((k === 'bgDataUrl' || k === 'photos' || k === 'coverDataUrl') ? undefined : v))); } catch (e) {}
    } catch (e) {
      setStatus(notes.length > 0 ? 'done' : 'idle');
      setError(String(e.message || e));
    }
  }
  const start = () => run({});
  const startFeed = (feed) => run({ feed });

  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="workbench">
      <div className="lanyard" />
      <header className="topbar">
        <EmployeeCard profile={profile} mini />
        <div className="topbarRight">
          <span className="topbarDate">{dateStr}</span>
          <button className="btn btnGhost btnSmall" onClick={onRetrain}>重新培训（改档案）</button>
        </div>
      </header>

      <DnaBar />

      <div className="modeTabs">
        <button className={`modeTab ${mode === 'assets' ? 'on' : ''}`} onClick={() => status !== 'working' && setMode('assets')}>
          🎬 素材成片<span>丢素材+主题，出能发的内容</span>
        </button>
        <button className={`modeTab ${mode === 'feed' ? 'on' : ''}`} onClick={() => status !== 'working' && setMode('feed')}>
          📸 投喂一条<span>给素材，精做一条</span>
        </button>
        <button className={`modeTab ${mode === 'daily' ? 'on' : ''}`} onClick={() => status !== 'working' && setMode('daily')}>
          🗓 日更三条<span>阿抖自主选题</span>
        </button>
      </div>

      {mode === 'assets' ? (
        <AssetsStudio profile={profile} />
      ) : mode === 'feed' ? (
        <div className="card controlCard feedControlCard">
          <FeedPanel working={status === 'working'} onProduce={startFeed} onStop={stopWork} />
        </div>
      ) : (
        <div className="card controlCard">
          <div className="controlLeft">
            <div className="sectionLabel">今日热点投喂（可选）</div>
            <textarea
              rows={2}
              value={hot}
              onChange={(e) => setHot(e.target.value)}
              placeholder="把抖音热点宝看到的热点、对标爆款的开头台词、行业新闻贴进来，阿抖会结合选题。空着也能干活。"
              disabled={status === 'working'}
            />
          </div>
          <div className="controlRight">
            <button
              className={`btn btnBig ${status === 'working' ? 'btnStop' : 'btnPrimary'}`}
              onClick={status === 'working' ? stopWork : start}
            >
              {status === 'working' ? '⏹ 阿抖工作中…点此叫停' : status === 'done' ? '重新生产今日内容' : '阿抖，开工'}
            </button>
            <div className="controlHint">交付物：3 个剧本包（Hook定稿＋分镜表＋字卡＋质检报告）</div>
          </div>
        </div>
      )}

      {error ? (
        <div className="card errorCard">
          生产中断：{error}
          <div className="errorHint">排查：① 含 429 → 网关并发/频率限流（已串行+重试）；② 含「思考过程/空内容」→ LLM_MODEL 换非思考版；③ 含 504/超时 → 模型出字太慢，换更快的模型；④ 走截图入职需配 LLM_MODEL_VISION。</div>
        </div>
      ) : null}

      <div className="mainGrid">
        <div className="deliverCol">
          {notes.length === 0 && status !== 'working' ? (
            <div className="card emptyCard">
              <div className="emptyEmoji">🎬</div>
              <div>{mode === 'feed' ? '上面给阿抖投喂素材：照片＋主题＋文风，她精做一条脚本给你。' : '交付区还是空的。点「阿抖，开工」，几分钟后来收今天的 3 个剧本包。'}</div>
            </div>
          ) : null}
          {status === 'working' && notes.length === 0 ? (
            <div className="card emptyCard">
              <div className="emptyEmoji">⏳</div>
              <div>生产线运转中——右侧工作日志可以看她每一步在干什么，包括质检打回返工。</div>
            </div>
          ) : null}
          {notes.map((n, i) => (
            <ScriptCard note={n} index={i} key={n.id ?? i} />
          ))}
        </div>
        <div className="logCol">
          <WorkLog entries={logs} />
        </div>
      </div>
    </div>
  );
}
