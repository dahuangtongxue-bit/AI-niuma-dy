'use client';

import { useEffect, useState } from 'react';
import OnboardingForm from '@/components/OnboardingForm';
import EmployeeCard from '@/components/EmployeeCard';
import Workbench from '@/components/Workbench';

const KEY = 'dy-employee:profile';

export default function Page() {
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setProfile(JSON.parse(saved));
    } catch (e) { /* 忽略 */ }
    setReady(true);
  }, []);

  function hire(p) {
    setProfile(p);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
  }

  function retrain() {
    setProfile(null);
    try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
  }

  if (!ready) return null;

  if (!profile) {
    return (
      <div className="onboarding">
        <div className="lanyard" />
        <div className="onboardHero">
          <h1>给你的品牌，雇一位<span className="hl">抖音运营专员</span></h1>
          <p>她叫阿抖。每天交付 3 个能直接开拍的剧本包：黄金3秒定稿、分镜表、成套字卡、质检报告、剪映组装指引，一样不少。</p>
        </div>
        <div className="onboardGrid">
          <div className="onboardBadge">
            <EmployeeCard profile={null} />
            <div className="badgeCaption">填完右边的入职登记表，工牌即刻生效</div>
          </div>
          <OnboardingForm onHire={hire} />
        </div>
      </div>
    );
  }

  return <Workbench profile={profile} onRetrain={retrain} />;
}
