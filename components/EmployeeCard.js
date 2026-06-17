// 工牌：数字员工的身份锚点（花名册 002 号）
export default function EmployeeCard({ profile, mini = false }) {
  const joined = profile?.joinedAt || '';

  if (mini) {
    return (
      <div className="badgeMini">
        <span className="badgeMiniAvatar">🥁</span>
        <span>
          <b>阿抖</b>
          <i className="mono"> LK-002</i>
          <em className="badgeMiniDept">营销部 · 抖音运营专员</em>
        </span>
        <span className="statusDot" title="在岗" />
      </div>
    );
  }

  return (
    <div className="badgeCard">
      <div className="badgeHole" />
      <div className="badgeAvatar">🥁</div>
      <div className="badgeName">阿抖</div>
      <div className="badgeId mono">工号 LK-002</div>
      <div className="badgeDept">营销部 · 抖音运营专员</div>
      <div className="badgeSkills">
        {['黄金3秒', '剧本节奏', '分镜拆解', '质检风控'].map((s) => (
          <span className="chip" key={s}>{s}</span>
        ))}
      </div>
      <div className="badgeFoot">
        <span>{joined ? `入职 ${joined}` : '待入职'}</span>
        <span className="stamp">试用期</span>
      </div>
    </div>
  );
}
