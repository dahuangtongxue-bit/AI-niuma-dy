'use client';
import { useState, useEffect, useRef } from 'react';
import { listDNAs, addDNA, removeDNA, setCurrent, getCurrentKey } from '@/lib/dna';

// 顶部品牌DNA条：从司南导出的品牌DNA在这里装载。可装多个品牌，随时切换。
export default function DnaBar() {
  const [dnas, setDnas] = useState([]);
  const [cur, setCur] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  function refresh() {
    setDnas(listDNAs());
    setCur(getCurrentKey());
  }
  useEffect(() => { refresh(); }, []);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const dna = JSON.parse(text);
      addDNA(dna);
      refresh();
      setMsg(`✓ 已装载「${dna.profile?.name || '品牌'}」`);
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg('✗ ' + (err.message || '导入失败'));
      setTimeout(() => setMsg(''), 3000);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSwitch(e) {
    setCurrent(e.target.value);
    refresh();
  }

  function onRemove() {
    const item = dnas.find((x) => x.key === cur);
    if (!item) return;
    if (!confirm(`移除品牌「${item.dna?.profile?.name || '未命名'}」的DNA？`)) return;
    removeDNA(cur);
    refresh();
  }

  const curItem = dnas.find((x) => x.key === cur);
  const personaName = curItem?.dna?.soul?.personaName || '';

  return (
    <div className="dnaBar">
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPick} hidden />
      <span className="dnaIcon">🧬</span>
      {dnas.length === 0 ? (
        <>
          <span className="dnaLabel">品牌DNA：未装载（用阿抖自己的档案干活）</span>
          <button className="dnaBtn dnaBtnMain" onClick={() => fileRef.current?.click()}>⬆ 导入品牌DNA</button>
        </>
      ) : (
        <>
          <span className="dnaLabel">当前品牌</span>
          <select className="dnaSelect" value={cur} onChange={onSwitch}>
            {dnas.map((x) => (
              <option key={x.key} value={x.key}>
                {x.dna?.profile?.name || '未命名'}{x.dna?.soul?.personaName ? ` · ${x.dna.soul.personaName}` : ''}
              </option>
            ))}
          </select>
          {personaName && <span className="dnaPersona">{personaName}</span>}
          <button className="dnaBtn" onClick={() => fileRef.current?.click()}>＋导入</button>
          <button className="dnaBtn dnaBtnDanger" onClick={onRemove}>移除</button>
        </>
      )}
      {msg && <span className="dnaMsg">{msg}</span>}
    </div>
  );
}
