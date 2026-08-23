/**
 * Smart Ration Distribution System - Beneficiary Portal JS
 * Pure Vanilla JavaScript (ES6+)
 * Handlers for section navigation, session loading, profile dropdowns, search, and settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. STATE & DOM ELEMENT REFERENCES
  // =========================================================================
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  
  const navItems = document.querySelectorAll('.nav-item');
  const contentSections = document.querySelectorAll('.content-section');
  
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  const notifToggleBtn = document.getElementById('notifToggleBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const profileToggleBtn = document.getElementById('profileToggleBtn');
  const profileMenu = document.getElementById('profileMenu');
  
  const menuLogoutBtn = document.getElementById('menuLogoutBtn');
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const menuProfileBtn = document.getElementById('menuProfileBtn');
  const menuSettingsBtn = document.getElementById('menuSettingsBtn');
  
  const historySearchInput = document.getElementById('historySearchInput');
  const historyTableBody = document.getElementById('historyTableBody');
  const changePasswordForm = document.getElementById('changePasswordForm');

  // Section titles mapping
  const sectionMeta = {
    dashboard: {
      title: "Dashboard Overview",
      subtitle: "Ration Card: RC-884210 • Priority Household (PHH)"
    },
    allocation: {
      title: "My Monthly Allocation",
      subtitle: "Official Government Ration Entitlement for August 2026"
    },
    history: {
      title: "Collection History",
      subtitle: "Past monthly ration distribution transactions ledger"
    },
    notifications: {
      title: "Notifications & Circulars",
      subtitle: "Official updates from Food & Civil Supplies Department"
    },
    profile: {
      title: "Beneficiary Profile",
      subtitle: "Registered household members and cardholder details"
    },
    settings: {
      title: "Account Settings",
      subtitle: "Security preferences and password management"
    }
  };

  // =========================================================================
  // 2. SESSION INITIALIZATION
  // =========================================================================
  function initSession() {
    let currentUser = null;
    try {
      const stored = localStorage.getItem('ration_auth_session');
      if (stored) {
        currentUser = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read auth session:", e);
    }

    // Default user fallback
    const user = currentUser || {
      name: "Anand Kumar",
      cardNo: "RC-884210",
      category: "PHH",
      avatar: "AK"
    };

    // Update UI elements
    const nameStr = user.name || "Anand Kumar";
    const cardStr = user.cardNo || user.identifier || "RC-884210";
    const initials = nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "AK";

    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserCard = document.getElementById('sidebarUserCard');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const topUserName = document.getElementById('topUserName');
    const menuUserName = document.getElementById('menuUserName');
    const welcomeUserName = document.getElementById('welcomeUserName');
    const topAvatar = document.getElementById('topAvatar');
    const profileHeadName = document.getElementById('profileHeadName');
    const profileCardNum = document.getElementById('profileCardNum');
    const topCardNumber = document.getElementById('topCardNumber');

    if (sidebarUserName) sidebarUserName.textContent = nameStr;
    if (sidebarUserCard) sidebarUserCard.textContent = cardStr;
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (topUserName) topUserName.textContent = nameStr;
    if (menuUserName) menuUserName.textContent = nameStr;
    if (welcomeUserName) welcomeUserName.textContent = nameStr;
    if (topAvatar) topAvatar.textContent = initials;
    if (profileHeadName) profileHeadName.textContent = nameStr;
    if (profileCardNum) profileCardNum.textContent = cardStr;
    if (topCardNumber) topCardNumber.textContent = `${cardStr} • PHH Card`;
  }

  // Set current date
  function initDate() {
    const currentDateStr = document.getElementById('currentDateStr');
    if (currentDateStr) {
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' };
      currentDateStr.textContent = new Date().toLocaleDateString('en-GB', options);
    }
  }

  // =========================================================================
  // 3. NAVIGATION & TAB SWITCHING
  // =========================================================================
  function switchTab(targetId) {
    // Hide all sections
    contentSections.forEach(section => {
      section.classList.add('hidden');
    });

    // Remove active class from nav items
    navItems.forEach(item => {
      item.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`${targetId}Section`);
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }

    // Mark matching nav item active
    const targetNavItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if (targetNavItem) {
      targetNavItem.classList.add('active');
    }

    // Update Page Header
    if (sectionMeta[targetId]) {
      if (pageTitle) pageTitle.textContent = sectionMeta[targetId].title;
      if (pageSubtitle) pageSubtitle.textContent = sectionMeta[targetId].subtitle;
    }

    // Close mobile menu if open
    closeMobileSidebar();
    
    // Close dropdowns
    if (notifDropdown) notifDropdown.classList.add('hidden');
    if (profileMenu) profileMenu.classList.add('hidden');
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      if (target) {
        switchTab(target);
      }
    });
  });

  // =========================================================================
  // 4. SIDEBAR RESPONSIVE TOGGLES
  // =========================================================================
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  function openMobileSidebar() {
    sidebar.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('mobile-open');
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('mobile-open');
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openMobileSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  // =========================================================================
  // 5. DROPDOWN TOGGLES & MENU ACTIONS
  // =========================================================================
  if (notifToggleBtn && notifDropdown) {
    notifToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
      if (profileMenu) profileMenu.classList.add('hidden');
    });
  }

  if (profileToggleBtn && profileMenu) {
    profileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
      if (notifDropdown) notifDropdown.classList.add('hidden');
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    if (notifDropdown) notifDropdown.classList.add('hidden');
    if (profileMenu) profileMenu.classList.add('hidden');
  });

  if (menuProfileBtn) {
    menuProfileBtn.addEventListener('click', () => switchTab('profile'));
  }

  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', () => switchTab('settings'));
  }

  // Logout handler
  function handleLogout() {
    if (confirm("Are you sure you want to log out of the Beneficiary Portal?")) {
      localStorage.removeItem('ration_auth_session');
      showToast("Logging out...", "info");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 500);
    }
  }

  if (menuLogoutBtn) menuLogoutBtn.addEventListener('click', handleLogout);
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

  // =========================================================================
  // 6. HISTORY TABLE SEARCH
  // =========================================================================
  if (historySearchInput && historyTableBody) {
    historySearchInput.addEventListener('input', () => {
      const query = historySearchInput.value.toLowerCase().trim();
      const rows = historyTableBody.querySelectorAll('tr');

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  // =========================================================================
  // 7. SETTINGS FORM HANDLER
  // =========================================================================
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newPass = document.getElementById('newPassInput').value;
      const confirmPass = document.getElementById('confirmPassInput').value;

      if (newPass !== confirmPass) {
        showToast("New password and confirm password do not match!", "error");
        return;
      }

      showToast("Password updated successfully!", "success");
      changePasswordForm.reset();
    });
  }

  // Toast alert utility
  function showToast(message, type = "info") {
    const existing = document.querySelector('.toast-alert');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    if (type === 'error') toast.style.backgroundColor = '#DC2626';
    if (type === 'success') toast.style.backgroundColor = '#059669';

    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 3500);
  }

  // =========================================================================
  // BENEFICIARY NOTIFICATIONS SYSTEM (Pure In-Memory JS)
  // =========================================================================
  let beneficiaryNotifications = [
    {
      id: 'BEN-NOTIF-101',
      title: 'August Monthly Ration Allocation Credited',
      shortMsg: 'Your August 2026 ration balance (20kg Rice, 2L Oil) is available.',
      fullMsg: 'Food & Civil Supplies Dept has credited your August 2026 quota under Priority Household (PHH) card scheme. You can collect your commodities from Sri Annapurna Ration Store (FPS-4201) anytime before August 15, 2026.',
      date: '03 Aug 2026',
      time: '08:00 AM',
      status: 'Unread',
      category: 'Allocation Credited',
      issuer: 'Department of Civil Supplies',
      expanded: false
    },
    {
      id: 'BEN-NOTIF-102',
      title: 'Fair Price Shop Collection Reminder',
      shortMsg: 'Please collect your ration quota from FPS-4201 before August 15.',
      fullMsg: 'Gentle reminder to visit FPS-4201 (Licensee: Ramesh Chandra, Belagavi) with your Ration Card and Aadhaar biometric for August distribution.',
      date: '02 Aug 2026',
      time: '10:30 AM',
      status: 'Unread',
      category: 'Collection Reminder',
      issuer: 'FPS-4201 Store Manager',
      expanded: false
    },
    {
      id: 'BEN-NOTIF-103',
      title: 'Previous Ration Disbursed Successfully',
      shortMsg: 'July 2026 ration collection recorded successfully via e-POS biometric terminal.',
      fullMsg: 'Official confirmation: July 10, 2026 collection pass #PASS-8841 was registered at Sri Annapurna Store (FPS-4201). Disbursement status is complete.',
      date: '10 Jul 2026',
      time: '11:45 AM',
      status: 'Read',
      category: 'Disbursement Complete',
      issuer: 'e-POS Biometric Server',
      expanded: false
    },
    {
      id: 'BEN-NOTIF-104',
      title: 'FPS Store Operating Hours Notice',
      shortMsg: 'FPS-4201 operating hours: 08:00 AM - 01:00 PM & 03:00 PM - 07:00 PM.',
      fullMsg: 'Sri Annapurna Ration Store remains open on all weekdays except Sunday afternoon. Please bring your registered family member for e-POS Aadhaar matching.',
      date: '01 Jul 2026',
      time: '09:00 AM',
      status: 'Read',
      category: 'FPS Store Notice',
      issuer: 'Civil Supplies Inspector',
      expanded: false
    }
  ];

  let activeBenNotifFilter = 'all';

  function renderBeneficiaryNotifications() {
    const feedList = document.getElementById('benNotifList');
    const dropdownList = document.getElementById('notifDropdownList');
    const bellCount = document.getElementById('benNotifBellCount');
    const navBadge = document.getElementById('navNotifCount');
    const dropdownBadge = document.getElementById('notifDropdownBadge');

    const unreadCount = beneficiaryNotifications.filter(n => n.status === 'Unread').length;

    // Update Bell Counter Badge
    if (bellCount) {
      bellCount.textContent = unreadCount;
      if (unreadCount === 0) {
        bellCount.classList.add('zero');
        bellCount.style.display = 'none';
      } else {
        bellCount.classList.remove('zero');
        bellCount.style.display = 'inline-block';
      }
    }

    // Update Sidebar Navigation Badge
    if (navBadge) {
      navBadge.textContent = unreadCount;
      if (unreadCount === 0) {
        navBadge.style.display = 'none';
      } else {
        navBadge.style.display = 'inline-block';
      }
    }

    // Update Dropdown Header Badge
    if (dropdownBadge) {
      dropdownBadge.textContent = unreadCount === 0 ? '0 Unread' : `${unreadCount} Unread`;
    }

    // Filter list
    let filtered = beneficiaryNotifications;
    if (activeBenNotifFilter === 'unread') {
      filtered = beneficiaryNotifications.filter(n => n.status === 'Unread');
    } else if (activeBenNotifFilter === 'read') {
      filtered = beneficiaryNotifications.filter(n => n.status === 'Read');
    }

    // 1. Render Main Notifications Feed List
    if (feedList) {
      feedList.innerHTML = '';
      if (filtered.length === 0) {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            <p style="font-weight: 600;">No notifications found under '${activeBenNotifFilter.toUpperCase()}' filter.</p>
          </div>
        `;
      } else {
        filtered.forEach(notif => {
          const item = document.createElement('div');
          item.className = `notification-feed-item ${notif.status === 'Unread' ? 'unread' : 'read'}`;

          item.innerHTML = `
            <div class="feed-item-header">
              <span class="feed-title">
                ${notif.status === 'Unread' ? '<span class="unread-dot"></span>' : ''}
                ${notif.title}
              </span>
              <span class="badge ${notif.status === 'Unread' ? 'badge-unread' : 'badge-read'}">${notif.status}</span>
            </div>
            <p class="feed-body">${notif.shortMsg}</p>
            ${notif.expanded ? `
              <div class="expanded-detail-box" style="margin: 10px 0; padding: 12px; background: #F8FAFC; border-left: 3px solid #2563EB; border-radius: 6px; font-size: 0.88rem; color: #1E293B; line-height: 1.5;">
                <strong>Full Message Details:</strong> ${notif.fullMsg}
              </div>
            ` : ''}
            <div class="feed-footer">
              <span>Category: ${notif.category} • Issuer: ${notif.issuer}</span>
              <span>📅 ${notif.date} | 🕒 ${notif.time}</span>
            </div>
          `;

          item.addEventListener('click', () => {
            notif.status = 'Read';
            notif.expanded = !notif.expanded;
            renderBeneficiaryNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    // 2. Render Top Dropdown List
    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = beneficiaryNotifications.slice(0, 5);
      if (recentList.length === 0) {
        dropdownList.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748B;">No notifications</div>';
      } else {
        recentList.forEach(notif => {
          const item = document.createElement('div');
          item.className = `notif-item ${notif.status === 'Unread' ? 'unread' : ''}`;
          item.style.padding = '10px 12px';
          item.style.borderBottom = '1px solid #E2E8F0';
          item.style.cursor = 'pointer';

          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <strong style="font-size: 0.85rem; color: #0F172A;">${notif.title}</strong>
              <span class="badge ${notif.status === 'Unread' ? 'badge-unread' : 'badge-read'}" style="font-size: 0.68rem;">${notif.status}</span>
            </div>
            <p style="font-size: 0.78rem; color: #64748B; margin: 4px 0;">${notif.shortMsg}</p>
            <span style="font-size: 0.72rem; color: #94A3B8;">${notif.date}, ${notif.time}</span>
          `;

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            notif.status = 'Read';
            notif.expanded = true;
            switchTab('notifications');
            renderBeneficiaryNotifications();
          });

          dropdownList.appendChild(item);
        });
      }
    }
  }

  // Filter Buttons Handler
  const benFilterGroup = document.getElementById('benNotifFilterGroup');
  if (benFilterGroup) {
    const filterBtns = benFilterGroup.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeBenNotifFilter = btn.dataset.filter || 'all';
        renderBeneficiaryNotifications();
      });
    });
  }

  // Mark All as Read
  const benNotifMarkAllReadBtn = document.getElementById('benNotifMarkAllReadBtn');
  if (benNotifMarkAllReadBtn) {
    benNotifMarkAllReadBtn.addEventListener('click', () => {
      beneficiaryNotifications.forEach(n => n.status = 'Read');
      renderBeneficiaryNotifications();
      showToast("All notifications marked as Read.", "success");
    });
  }

  // Clear Read Notifications
  const benNotifClearReadBtn = document.getElementById('benNotifClearReadBtn');
  if (benNotifClearReadBtn) {
    benNotifClearReadBtn.addEventListener('click', () => {
      beneficiaryNotifications = beneficiaryNotifications.filter(n => n.status === 'Unread');
      renderBeneficiaryNotifications();
      showToast("Read notifications cleared.", "info");
    });
  }

  // Initial call
  initSession();
  initDate();
  renderBeneficiaryNotifications();
});
