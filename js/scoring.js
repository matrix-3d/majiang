(function () {
  const INVITE_CODE_LEN = 6;

  function genInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < INVITE_CODE_LEN; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function getSupabase() {
    if (typeof supabase === 'undefined') return null;
    if (window._scoringSupabase) return window._scoringSupabase;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    window._scoringSupabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return window._scoringSupabase;
  }

  function showScoringSetup(el) {
    el.innerHTML = `
      <div class="scoring-setup-card card">
        <h3 class="scoring-setup-title">未配置 Supabase</h3>
        <p class="scoring-setup-desc">多人计分需要先配置 Supabase 后端。请编辑 <code>js/supabase-config.js</code>，填入 Project URL 与 anon key。</p>
        <p class="scoring-setup-desc"><a href="SUPABASE_SETUP.md" target="_blank" rel="noopener">查看配置说明</a></p>
      </div>
    `;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function avatarLetter(name) {
    if (!name || !name.trim()) return '?';
    return (name.trim()[0] || '?').toUpperCase();
  }

  // ---------- 登录 / 注册 ----------
  function renderAuth(container, sb) {
    container.innerHTML = `
      <div class="scoring-auth card">
        <h3 class="scoring-section-title">登录 / 注册</h3>
        <div class="scoring-auth-tabs">
          <button type="button" class="scoring-auth-tab active" data-mode="login">登录</button>
          <button type="button" class="scoring-auth-tab" data-mode="signup">注册</button>
        </div>
        <form class="scoring-auth-form" id="scoringAuthForm">
          <div class="scoring-auth-field" id="fieldDisplayName" style="display:none">
            <label>用户名</label>
            <input type="text" id="authDisplayName" placeholder="显示昵称" autocomplete="username" />
          </div>
          <div class="scoring-auth-field">
            <label>邮箱</label>
            <input type="email" id="authEmail" placeholder="用于登录" autocomplete="email" required />
          </div>
          <div class="scoring-auth-field">
            <label>密码</label>
            <input type="password" id="authPassword" placeholder="至少 6 位" autocomplete="current-password" required minlength="6" />
          </div>
          <button type="submit" class="btn btn-primary" id="authSubmit">登录</button>
          <p class="scoring-auth-err" id="authErr"></p>
        </form>
      </div>
    `;

    const form = document.getElementById('scoringAuthForm');
    const errEl = document.getElementById('authErr');
    const displayNameWrap = document.getElementById('fieldDisplayName');
    const submitBtn = document.getElementById('authSubmit');
    const tabs = container.querySelectorAll('.scoring-auth-tab');

    function setMode(mode) {
      const isSignup = mode === 'signup';
      displayNameWrap.style.display = isSignup ? 'block' : 'none';
      submitBtn.textContent = isSignup ? '注册' : '登录';
      errEl.textContent = '';
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    }

    tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '提交中...';
      errEl.style.color = 'var(--apple-text-secondary)';
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const isSignup = submitBtn.textContent === '注册';

      try {
        if (isSignup) {
          const displayName = document.getElementById('authDisplayName').value.trim() || email.split('@')[0];
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } }
          });
          
          if (error) throw error;

          if (data.user) {
            await sb.from('profiles').upsert(
              { id: data.user.id, email: data.user.email || '', display_name: displayName },
              { onConflict: 'id' }
            );
          }

          if (data.user && !data.session) {
            errEl.textContent = '注册成功！请查收邮件确认后登录（如果不需要确认，请切到“登录”重试）';
            errEl.style.color = 'var(--apple-blue)';
            return;
          }
          if (data.session) { renderAfterLogin(container, sb); return; }
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.session) { renderAfterLogin(container, sb); return; }
        }
      } catch (error) {
        errEl.style.color = 'var(--apple-red)';
        errEl.textContent = (error.message === 'User already registered') ? '该邮箱已注册，请直接登录' 
                        : (error.message === 'Invalid login credentials') ? '邮箱或密码错误'
                        : error.message;
      }
    });
  }

  // ---------- 已登录：创建/加入房间 ----------
  function renderAfterLogin(container, sb) {
    container.innerHTML = `
      <div class="scoring-landing card">
        <div class="scoring-user-bar">
          <span class="scoring-user-info" id="scoringUserInfo">加载中…</span>
          <button type="button" class="btn btn-ghost btn-small" id="scoringLogout">退出</button>
        </div>
        <div class="scoring-account-card" id="scoringAccountCard">
          <h4 class="scoring-account-title">当前账户</h4>
          <p class="scoring-account-row"><span class="scoring-account-label">登录账号（邮箱）</span><span id="scoringAccountEmail">—</span></p>
          <p class="scoring-account-row"><span class="scoring-account-label">显示昵称</span><span id="scoringAccountName">—</span></p>
          <p class="scoring-account-tip">密码出于安全不会保存或显示，请自行牢记。忘记密码需在 Supabase 控制台或通过「找回密码」功能重置。</p>
        </div>
        <h3 class="scoring-section-title">创建或加入房间</h3>
        <div class="scoring-landing-actions">
          <button type="button" class="btn btn-primary" id="scoringBtnCreate">创建房间</button>
          <div class="scoring-join-row">
            <input type="text" id="scoringInviteCode" class="scoring-invite-input" placeholder="输入 ${INVITE_CODE_LEN} 位邀请码" maxlength="${INVITE_CODE_LEN}" />
            <button type="button" class="btn btn-primary" id="scoringBtnJoin">加入房间</button>
          </div>
        </div>
        <p class="scoring-hint">创建房间后把邀请码发给其他人，每人登录后加入同一房间；只能操作自己的积分，点击他人头像可给 Ta 转积分。</p>
      </div>
    `;

    sb.auth.getUser().then(({ data: userData }) => {
      const user = userData && userData.user;
      window._scoringUser = user;
      if (user) {
        sb.from('profiles').select('display_name').eq('id', user.id).single().then(({ data: p }) => {
          const name = (p && p.display_name) ? p.display_name : (user.email || '').split('@')[0] || '我';
          document.getElementById('scoringUserInfo').textContent = name + '（' + (user.email || '') + '）';
          const emailEl = document.getElementById('scoringAccountEmail');
          const nameEl = document.getElementById('scoringAccountName');
          if (emailEl) emailEl.textContent = user.email || '—';
          if (nameEl) nameEl.textContent = name;
        });
      }
    });

    document.getElementById('scoringLogout').addEventListener('click', async () => {
      await sb.auth.signOut();
      window._scoringUser = null;
      renderAuth(container, sb);
    });
    document.getElementById('scoringBtnCreate').addEventListener('click', () => createRoom(sb, container));
    document.getElementById('scoringBtnJoin').addEventListener('click', () => joinRoom(sb, container));
    document.getElementById('scoringInviteCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('scoringBtnJoin').click();
    });
  }

  async function createRoom(sb, container) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const btn = document.getElementById('scoringBtnCreate');
    const origText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '创建中…'; }
    try {
      const code = genInviteCode();
      const { data: room, error: roomErr } = await sb.from('rooms').insert({
        invite_code: code,
        created_by: user.id
      }).select('id').single();
      if (roomErr) {
        alert('创建房间失败：' + (roomErr.message || '请稍后重试'));
        return;
      }
      await sb.from('room_members').insert({ room_id: room.id, user_id: user.id });
      await sb.from('room_balances').insert({ room_id: room.id, user_id: user.id, balance: 0 });
      enterRoom(sb, container, room.id, code);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText || '创建房间'; }
    }
  }

  async function joinRoom(sb, container) {
    const input = document.getElementById('scoringInviteCode');
    const code = (input.value || '').trim().toUpperCase();
    if (code.length !== INVITE_CODE_LEN) {
      alert('请输入 ' + INVITE_CODE_LEN + ' 位邀请码');
      return;
    }
    const btn = document.getElementById('scoringBtnJoin');
    const origText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '加入中…'; }
    try {
      const { data: room, error } = await sb.from('rooms').select('id').eq('invite_code', code).single();
      if (error || !room) {
        alert('未找到该房间，请检查邀请码');
        return;
      }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { error: joinErr } = await sb.from('room_members').insert({ room_id: room.id, user_id: user.id });
      if (joinErr && joinErr.code !== '23505') {
        alert('加入失败：' + (joinErr.message || '请重试'));
        return;
      }
      const { error: balErr } = await sb.from('room_balances').insert({ room_id: room.id, user_id: user.id, balance: 0 });
      if (balErr && balErr.code !== '23505') { /* already exists ok */ }
      enterRoom(sb, container, room.id, code);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText || '加入房间'; }
    }
  }

  function enterRoom(sb, container, roomId, inviteCode) {
    window._scoringRoomId = roomId;
    window._scoringInviteCode = inviteCode;
    renderRoom(sb, container);
    subscribeRoom(sb, container);
  }

  function renderRoom(sb, container) {
    const roomId = window._scoringRoomId;
    const code = window._scoringInviteCode;

    container.innerHTML = `
      <div class="scoring-room card">
        <div class="scoring-room-header">
          <h3 class="scoring-section-title">计分房间</h3>
          <div class="scoring-invite-display">
            <span class="scoring-invite-label">邀请码</span>
            <strong class="scoring-invite-code">${escapeHtml(code)}</strong>
            <button type="button" class="btn btn-small" id="scoringCopyCode">复制</button>
          </div>
        </div>
        <div class="scoring-members" id="scoringMembersList"></div>
        <div class="scoring-history" id="scoringHistory"></div>
        <button type="button" class="btn btn-ghost" id="scoringBtnLeave">离开房间</button>
      </div>
    `;

    document.getElementById('scoringCopyCode').addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => alert('已复制邀请码'));
    });
    document.getElementById('scoringBtnLeave').addEventListener('click', () => {
      delete window._scoringRoomId;
      delete window._scoringInviteCode;
      if (window._scoringUnsubscribe) window._scoringUnsubscribe();
      renderAfterLogin(container, sb);
    });

    loadMembersAndBalances(sb, container, roomId);
    loadTransferHistory(sb, container, roomId);
  }

  async function loadMembersAndBalances(sb, container, roomId) {
    const listEl = document.getElementById('scoringMembersList');
    if (!listEl) return;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data: members } = await sb.from('room_members').select('user_id').eq('room_id', roomId);
    if (!members || members.length === 0) {
      listEl.innerHTML = '<p class="scoring-empty">暂无成员</p>';
      return;
    }

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, display_name').in('id', userIds);
    const { data: balances } = await sb.from('room_balances').select('user_id, balance').eq('room_id', roomId);

    const nameById = {};
    (profiles || []).forEach((p) => { nameById[p.id] = p.display_name || (p.id === user.id ? '我' : '?'); });
    const balanceById = {};
    (balances || []).forEach((b) => { balanceById[b.user_id] = b.balance; });

    listEl.innerHTML = userIds.map((uid) => {
      const name = nameById[uid] || '?';
      const balance = balanceById[uid] != null ? balanceById[uid] : 0;
      const isSelf = uid === user.id;
      const letter = avatarLetter(name);
      return `
        <div class="scoring-member ${isSelf ? 'scoring-member-self' : 'scoring-member-other'}" data-user-id="${escapeHtml(uid)}" data-name="${escapeHtml(name)}" data-balance="${balance}">
          <button type="button" class="scoring-avatar" ${isSelf ? 'disabled title="不能转给自己"' : 'title="点击给 Ta 转积分"'} aria-label="${isSelf ? '自己' : '转给 ' + escapeHtml(name)}">
            <span class="scoring-avatar-letter">${escapeHtml(letter)}</span>
          </button>
          <div class="scoring-member-info">
            <span class="scoring-member-name">${escapeHtml(name)}${isSelf ? '（我）' : ''}</span>
            <span class="scoring-member-balance ${balance < 0 ? 'negative' : ''}">${balance}</span>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.scoring-member-other .scoring-avatar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.scoring-member');
        const toUserId = row.dataset.userId;
        const toName = row.dataset.name;
        openTransferModal(sb, container, roomId, toUserId, toName);
      });
    });
  }

  function openTransferModal(sb, container, roomId, toUserId, toName) {
    const overlay = document.createElement('div');
    overlay.className = 'scoring-modal-overlay';
    overlay.innerHTML = `
      <div class="scoring-modal card">
        <h4 class="scoring-modal-title">转积分给 ${escapeHtml(toName)}</h4>
        <p class="scoring-modal-desc">只能从自己的积分中转出，请填写数量。</p>
        <label class="scoring-modal-field">
          <span>数量</span>
          <input type="number" id="transferAmount" min="1" value="1" />
        </label>
        <p class="scoring-modal-err" id="transferErr"></p>
        <div class="scoring-modal-actions">
          <button type="button" class="btn btn-ghost" id="transferCancel">取消</button>
          <button type="button" class="btn btn-primary" id="transferConfirm">确认</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#transferCancel').addEventListener('click', close);

    overlay.querySelector('#transferConfirm').addEventListener('click', async () => {
      const errEl = overlay.querySelector('#transferErr');
      const confirmBtn = overlay.querySelector('#transferConfirm');
      const amount = parseInt(overlay.querySelector('#transferAmount').value, 10);
      if (!Number.isInteger(amount) || amount <= 0) {
        errEl.textContent = '请输入正整数';
        return;
      }
      errEl.textContent = '';
      const origConfirmText = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '转积分中…';
      try {
        const { error } = await sb.rpc('transfer_points', {
          p_room_id: roomId,
          p_to_user_id: toUserId,
          p_amount: amount
        });
        if (error) {
          const msg = error.message === 'insufficient balance' ? '积分不足'
            : error.message === 'cannot transfer to self' ? '不能转给自己'
            : error.message === 'not authenticated' ? '请先登录'
            : error.message === 'amount must be positive' ? '请输入正整数'
            : (error.message || '转积分失败');
          errEl.textContent = msg;
          return;
        }
        close();
        loadMembersAndBalances(sb, container, roomId);
        loadTransferHistory(sb, container, roomId);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = origConfirmText;
      }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('#transferAmount').focus();
  }

  async function loadTransferHistory(sb, container, roomId) {
    const historyEl = document.getElementById('scoringHistory');
    if (!historyEl) return;

    const { data: logs } = await sb.from('transfer_log')
      .select('from_user_id, to_user_id, amount, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!logs || logs.length === 0) {
      historyEl.innerHTML = '<h4 class="scoring-history-title">转积分记录</h4><p class="scoring-no-history">暂无记录</p>';
      return;
    }

    const userIds = new Set();
    logs.forEach((l) => { userIds.add(l.from_user_id); userIds.add(l.to_user_id); });
    const { data: profiles } = await sb.from('profiles').select('id, display_name').in('id', Array.from(userIds));
    const nameById = {};
    (profiles || []).forEach((p) => { nameById[p.id] = p.display_name || '?'; });

    historyEl.innerHTML = `
      <h4 class="scoring-history-title">转积分记录</h4>
      <ul class="scoring-history-list">
        ${logs.map((l) => {
          const from = nameById[l.from_user_id] || '?';
          const to = nameById[l.to_user_id] || '?';
          const time = new Date(l.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `<li>${escapeHtml(from)} → ${escapeHtml(to)} <strong>+${l.amount}</strong> <span class="scoring-history-time">${time}</span></li>`;
        }).join('')}
      </ul>
    `;
  }

  function subscribeRoom(sb, container) {
    const roomId = window._scoringRoomId;
    const channel = sb.channel('room-balances-' + roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_balances', filter: 'room_id=eq.' + roomId }, () => {
        loadMembersAndBalances(sb, container, roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_log', filter: 'room_id=eq.' + roomId }, () => {
        loadMembersAndBalances(sb, container, roomId);
        loadTransferHistory(sb, container, roomId);
      })
      .subscribe();
    window._scoringUnsubscribe = () => sb.removeChannel(channel);
  }

  function init() {
    const view = document.getElementById('scoringView');
    const container = document.getElementById('scoringContainer');
    if (!view || !container) return;

    const sb = getSupabase();
    if (!sb) {
      showScoringSetup(container);
      return;
    }

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        window._scoringUser = session.user;
        if (window._scoringRoomId) {
          enterRoom(sb, container, window._scoringRoomId, window._scoringInviteCode || '');
        } else {
          renderAfterLogin(container, sb);
        }
      } else {
        if (window._scoringRoomId) {
          delete window._scoringRoomId;
          delete window._scoringInviteCode;
        }
        renderAuth(container, sb);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.scoringRefresh = function () {
    const container = document.getElementById('scoringContainer');
    const sb = getSupabase();
    if (sb && window._scoringRoomId && container) {
      loadMembersAndBalances(sb, container, window._scoringRoomId);
      loadTransferHistory(sb, container, window._scoringRoomId);
    }
  };
})();
