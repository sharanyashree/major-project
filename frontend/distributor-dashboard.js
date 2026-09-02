/**
 * Smart Ration Distribution System - FPS Distributor Portal Logic
 * Real Backend API Integration
 */

import { authStorage, authApi, distributorApi } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // =========================================================================
  // 1. AUTHENTICATION & SESSION VERIFICATION
  // =========================================================================
  const session = authStorage.getSession();
  const token = authStorage.getToken();

  if (!token || !session || !session.role || session.role.toLowerCase() !== 'distributor') {
    // If not authenticated as Distributor, redirect to login
    window.location.href = 'login.html';
    return;
  }

  // =========================================================================
  // 2. STATE DATA STORES
  // =========================================================================
  let distributorProfile = null;
  let assignedBeneficiaries = [];
  let currentInventory = { riceStock: 0, oilStock: 0 };
  let allocationHistory = [];
  let distributionRecords = [];
  let distributorNotifications = [];
  let activeDistNotifFilter = 'all';

  // =========================================================================
  // 3. DOM ELEMENTS
  // =========================================================================
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  const navItems = document.querySelectorAll('.nav-item');
  const navTriggers = document.querySelectorAll('.nav-trigger');
  const contentSections = document.querySelectorAll('.content-section');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  const topNotifBtn = document.getElementById('topNotifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');

  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');

  const toastAlert = document.getElementById('toastAlert');
  const toastMsg = document.getElementById('toastMsg');
  const toastCloseBtn = document.getElementById('toastCloseBtn');

  // =========================================================================
  // 4. NAVIGATION & SIDEBAR CONTROLS
  // =========================================================================
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      sidebarBackdrop.classList.add('mobile-open');
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      sidebarBackdrop.classList.remove('mobile-open');
    });
  }

  const sectionTitles = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Fair Price Shop • Operations Portal' },
    beneficiaries: { title: 'Beneficiary Details', subtitle: 'Assigned Family Records & Ration Cards' },
    'beneficiary-details': { title: 'Beneficiary Details', subtitle: 'Assigned Family Records & Ration Cards' },
    beneficiaryDetails: { title: 'Beneficiary Details', subtitle: 'Assigned Family Records & Ration Cards' },
    allocation: { title: 'Monthly Allocation', subtitle: 'Disburse Subsidized Foodgrain Quotas' },
    inventory: { title: 'FPS Store Inventory', subtitle: 'Real-time Stock Levels & Storage Reserves' },
    distribution: { title: 'Distribution Records', subtitle: 'Real-time Transaction History & Receipts' },
    notifications: { title: 'Notifications', subtitle: 'Official Directives from Civil Supplies Admin' },
    settings: { title: 'Distributor Settings', subtitle: 'FPS Store Profile & Security Configuration' },
  };

  function switchSection(targetKey) {
    if (!targetKey) return;
    let key = targetKey;
    if (key === 'beneficiary-details' || key === 'beneficiaryDetails' || key === 'beneficiary' || key === 'beneficiariesSection') {
      key = 'beneficiaries';
    }
    if (!sectionTitles[key]) return;

    navItems.forEach((item) => {
      const itemTarget = item.getAttribute('data-target');
      if (itemTarget === key || (key === 'beneficiaries' && (itemTarget === 'beneficiaries' || itemTarget === 'beneficiary-details'))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    contentSections.forEach((sec) => {
      if (sec.id === `${key}Section`) {
        sec.classList.remove('hidden');
        sec.classList.add('active');
      } else {
        sec.classList.add('hidden');
        sec.classList.remove('active');
      }
    });

    if (pageTitle) pageTitle.textContent = sectionTitles[key].title;
    if (pageSubtitle) {
      const storeName = distributorProfile ? `${distributorProfile.storeName || 'FPS Store'} • ${distributorProfile.fpsCode || 'FPS'}` : sectionTitles[key].subtitle;
      pageSubtitle.textContent = key === 'dashboard' ? storeName : sectionTitles[key].subtitle;
    }

    if (key === 'beneficiaries' && assignedBeneficiaries.length === 0) {
      loadAssignedBeneficiaries();
    }

    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetKey = item.getAttribute('data-target');
      switchSection(targetKey);
    });
  });

  navTriggers.forEach((trig) => {
    trig.addEventListener('click', (e) => {
      e.preventDefault();
      const targetKey = trig.getAttribute('data-target');
      switchSection(targetKey);
    });
  });

  // Global delegation for any dynamically created nav-trigger or data-target elements
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.nav-trigger, [data-target="beneficiaries"], [data-target="beneficiary-details"]');
    if (trigger && !trigger.classList.contains('nav-item')) {
      const targetKey = trigger.getAttribute('data-target');
      if (targetKey) {
        e.preventDefault();
        switchSection(targetKey);
      }
    }
  });

  // Current Date Display
  const currentDateText = document.getElementById('currentDateTimeText');
  if (currentDateText) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    currentDateText.textContent = now.toLocaleDateString('en-US', options);
  }

  // Dropdown toggles
  if (topNotifBtn) {
    topNotifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
      if (profileMenu) profileMenu.classList.add('hidden');
    });
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
      if (notifDropdown) notifDropdown.classList.add('hidden');
    });
  }

  document.addEventListener('click', () => {
    if (notifDropdown) notifDropdown.classList.add('hidden');
    if (profileMenu) profileMenu.classList.add('hidden');
  });

  if (notifDropdown) notifDropdown.addEventListener('click', (e) => e.stopPropagation());
  if (profileMenu) profileMenu.addEventListener('click', (e) => e.stopPropagation());

  // Logout Handlers
  function handleLogout() {
    if (confirm('Are you sure you want to log out of the FPS Distributor Portal?')) {
      authStorage.clearSession();
      window.location.href = 'login.html';
    }
  }

  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);
  if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);

  // Toast Alert Notification Helper
  function showToast(message, duration = 3500) {
    if (!toastAlert || !toastMsg) return;
    toastMsg.textContent = message;
    toastAlert.classList.remove('hidden');
    setTimeout(() => {
      toastAlert.classList.add('hidden');
    }, duration);
  }

  if (toastCloseBtn) {
    toastCloseBtn.addEventListener('click', () => toastAlert.classList.add('hidden'));
  }

  // =========================================================================
  // 5. DATA FETCHING & UI HYDRATION
  // =========================================================================

  // Helper to extract initials
  function getInitials(name) {
    if (!name) return 'DS';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Render Distributor Profile Across DOM
  function updateDistributorProfileUI(profile) {
    if (!profile) return;
    const name = profile.fullName || profile.name || 'FPS Distributor';
    const initials = getInitials(name);
    const fpsCode = profile.fpsCode || 'FPS-STORE';
    const storeName = profile.storeName || 'Fair Price Shop';
    const district = profile.district || 'District';
    const taluk = profile.taluk || '';
    const email = profile.email || 'distributor@pds.gov.in';
    const mobile = profile.mobileNumber || '';
    const distributorId = profile.distributorId || profile._id ? `DIST-${(profile.distributorId || profile._id).toString().slice(-4).toUpperCase()}` : 'DIST-001';

    // Sidebar footer
    const sidebarAvatar = document.querySelector('.sidebar-footer .user-avatar');
    const sidebarName = document.querySelector('.sidebar-footer .user-name');
    const sidebarRole = document.querySelector('.sidebar-footer .user-role');
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarRole) sidebarRole.textContent = `${fpsCode} Licensee`;

    // Top navbar profile button & dropdown
    const profileAvatar = document.querySelector('.profile-btn .profile-avatar');
    const profileName = document.querySelector('.profile-btn .profile-name');
    const profileRole = document.querySelector('.profile-btn .profile-role');
    const menuFullname = document.querySelector('.profile-menu .user-fullname');
    const menuEmail = document.querySelector('.profile-menu .user-email');
    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileName) profileName.textContent = name;
    if (profileRole) profileRole.textContent = `${fpsCode} Distributor`;
    if (menuFullname) menuFullname.textContent = name;
    if (menuEmail) menuEmail.textContent = email;

    // Top navbar subtitle & FPS pill
    if (pageSubtitle && document.querySelector('.nav-item.active')?.getAttribute('data-target') === 'dashboard') {
      pageSubtitle.textContent = `${storeName} • ${fpsCode}`;
    }
    const fpsInfoPill = document.querySelector('.fps-info-pill span');
    if (fpsInfoPill) {
      fpsInfoPill.textContent = `${fpsCode} • ${district} ${taluk ? `(${taluk})` : ''}`;
    }

    // Dashboard Overview Header & Depot Card
    const storeHeaderSummary = document.querySelector('#dashboardSection > div:first-child');
    if (storeHeaderSummary) {
      const h2 = storeHeaderSummary.querySelector('h2');
      const p = storeHeaderSummary.querySelector('p');
      if (h2) h2.textContent = `${storeName} (${fpsCode})`;
      if (p) p.textContent = `Fair Price Shop • ${district} ${taluk ? `(${taluk} Jurisdiction)` : ''}`;
    }

    // Depot Details Panel on Dashboard
    const depotDetailsItems = document.querySelectorAll('#dashboardSection .dashboard-panels-grid .card:last-child div > div');
    if (depotDetailsItems.length >= 3) {
      const badge = depotDetailsItems[0].querySelector('.badge');
      if (badge) badge.textContent = fpsCode;

      const licenseeDiv = depotDetailsItems[1].querySelector('div');
      if (licenseeDiv) licenseeDiv.textContent = `${name} (ID: ${distributorId})`;

      const jurisDiv = depotDetailsItems[2].querySelector('div');
      if (jurisDiv) jurisDiv.textContent = `${district} • ${taluk || 'Assigned Taluk'}`;
    }

    // Settings Profile Form Values
    const setDistId = document.getElementById('settingDistributorId');
    const setFpsCode = document.getElementById('settingFpsCode');
    const setFullName = document.getElementById('settingFullName');
    const setFpsName = document.getElementById('settingFpsName');
    const setDistrict = document.getElementById('settingDistrict');
    const setTaluk = document.getElementById('settingTaluk');
    const setMobile = document.getElementById('settingMobile');
    const setEmail = document.getElementById('settingEmail');

    if (setDistId) setDistId.value = distributorId;
    if (setFpsCode) setFpsCode.value = fpsCode;
    if (setFullName) setFullName.value = name;
    if (setFpsName) setFpsName.value = storeName;
    if (setDistrict) setDistrict.value = district;
    if (setTaluk) setTaluk.value = taluk;
    if (setMobile) setMobile.value = mobile;
    if (setEmail) setEmail.value = email;
  }

  // Load Dashboard Overview Data
  async function loadDashboardData() {
    try {
      const res = await distributorApi.getDashboardSummary();
      if (res && res.success && res.data) {
        distributorProfile = res.data.profile || distributorProfile;
        updateDistributorProfileUI(distributorProfile);

        if (res.data.inventory) {
          currentInventory = {
            riceStock: res.data.inventory.riceStock || 0,
            oilStock: res.data.inventory.oilStock || 0,
          };
          updateInventoryUI(currentInventory);
        }

        const totalBeneficiaries = res.data.metrics?.assignedBeneficiariesCount ?? res.data.totalBeneficiaries ?? assignedBeneficiaries.length;
        const totalStock = (currentInventory.riceStock || 0) + (currentInventory.oilStock || 0);

        const statTotalAvailableStock = document.getElementById('statTotalAvailableStock');
        if (statTotalAvailableStock) {
          statTotalAvailableStock.innerHTML = `${totalStock} <span class="unit">Units</span>`;
        }

        const statStockBreakdownSummary = document.getElementById('statStockBreakdownSummary');
        if (statStockBreakdownSummary) {
          statStockBreakdownSummary.textContent = `Rice: ${currentInventory.riceStock || 0} Kg | Oil: ${currentInventory.oilStock || 0} Ltr`;
        }

        const dashTotalBeneficiariesCount = document.getElementById('dashTotalBeneficiariesCount');
        if (dashTotalBeneficiariesCount) {
          dashTotalBeneficiariesCount.textContent = `${totalBeneficiaries} Families`;
        }
      }
    } catch (err) {
      console.error('Error loading distributor dashboard summary:', err);
    }
  }

  // =========================================================================
  // 6. BENEFICIARY MANAGEMENT
  // =========================================================================
  const beneficiariesTableBody = document.getElementById('beneficiariesTableBody');
  const beneficiarySearchInput = document.getElementById('beneficiarySearchInput');
  const villageFilterSelect = document.getElementById('villageFilterSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const beneficiariesCountText = document.getElementById('beneficiariesCountText');
  const dashTotalBeneficiariesCount = document.getElementById('dashTotalBeneficiariesCount');

  const beneficiaryModal = document.getElementById('beneficiaryModal');
  const openAddBeneficiaryModalBtn = document.getElementById('openAddBeneficiaryModalBtn');
  const closeBeneficiaryModalBtn = document.getElementById('closeBeneficiaryModalBtn');
  const cancelBeneficiaryModalBtn = document.getElementById('cancelBeneficiaryModalBtn');
  const beneficiaryForm = document.getElementById('beneficiaryForm');
  const beneficiaryModalTitle = document.getElementById('beneficiaryModalTitle');

  const viewBeneficiaryModal = document.getElementById('viewBeneficiaryModal');
  const viewBeneficiaryModalContent = document.getElementById('viewBeneficiaryModalContent');
  const closeViewBeneficiaryModalBtn = document.getElementById('closeViewBeneficiaryModalBtn');
  const confirmViewBeneficiaryModalBtn = document.getElementById('confirmViewBeneficiaryModalBtn');

  async function loadAssignedBeneficiaries() {
    try {
      if (beneficiariesTableBody) {
        beneficiariesTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
              Loading assigned beneficiaries...
            </td>
          </tr>
        `;
      }
      const res = await distributorApi.getAssignedBeneficiaries();
      if (res && res.success) {
        assignedBeneficiaries = res.data || [];
        populateVillageFilter(assignedBeneficiaries);
        renderBeneficiaries();
        populateAllocationDropdown();
      }
    } catch (err) {
      console.error('Error loading beneficiaries:', err);
      if (beneficiariesTableBody) {
        beneficiariesTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #EF4444;">
              Failed to load beneficiaries. Please retry.
            </td>
          </tr>
        `;
      }
    }
  }

  function populateVillageFilter(list) {
    if (!villageFilterSelect) return;
    const currentVal = villageFilterSelect.value;
    const villages = new Set();
    list.forEach((b) => {
      const loc = b.village || b.taluk || b.district;
      if (loc) villages.add(loc);
    });

    villageFilterSelect.innerHTML = '<option value="ALL">All Villages / Wards</option>';
    villages.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      villageFilterSelect.appendChild(opt);
    });

    if (currentVal && Array.from(villages).includes(currentVal)) {
      villageFilterSelect.value = currentVal;
    }
  }

  function renderBeneficiaries() {
    const query = beneficiarySearchInput ? beneficiarySearchInput.value.toLowerCase().trim() : '';
    const villageFilter = villageFilterSelect ? villageFilterSelect.value : 'ALL';
    const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'ALL';

    const filtered = assignedBeneficiaries.filter((b) => {
      const cardNo = (b.rationCardNumber || b.rationCardNo || '').toLowerCase();
      const name = (b.fullName || b.headOfFamily || '').toLowerCase();
      const mobile = (b.mobileNumber || '').toLowerCase();
      const location = `${b.district || ''} ${b.taluk || ''} ${b.village || ''}`.toLowerCase();
      const status = (b.status || 'Pending').toLowerCase();

      const matchQuery =
        cardNo.includes(query) ||
        name.includes(query) ||
        mobile.includes(query) ||
        location.includes(query);

      const matchVillage = villageFilter === 'ALL' || (b.village || b.taluk || b.district) === villageFilter;
      const matchStatus = statusFilter === 'ALL' || status === statusFilter.toLowerCase();

      return matchQuery && matchVillage && matchStatus;
    });

    if (beneficiariesTableBody) {
      beneficiariesTableBody.innerHTML = '';

      if (filtered.length === 0) {
        beneficiariesTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
              No beneficiary records found matching your filters.
            </td>
          </tr>
        `;
      } else {
        filtered.forEach((ben, index) => {
          const tr = document.createElement('tr');
          const cardNo = ben.rationCardNumber || ben.rationCardNo || 'N/A';
          const name = ben.fullName || ben.headOfFamily || 'Beneficiary';
          const mobile = ben.mobileNumber || 'N/A';
          const location = [ben.district, ben.taluk].filter(Boolean).join(' / ') || ben.village || 'Assigned Area';
          const riceQuota = ben.riceQuota ?? ben.riceAllowed ?? 0;
          const oilQuota = ben.oilQuota ?? ben.oilAllowed ?? 0;
          const isSubmitted = !!ben.submittedToAdmin || ben.submissionStatus === 'Submitted for Admin Review';

          const status = ben.status || 'Pending';
          let statusBadge = 'badge-warning';
          let statusLabel = status;

          if (status === 'Active' || status === 'Approved') {
            statusBadge = 'badge-success';
            statusLabel = 'Active';
          } else if (status === 'Rejected') {
            statusBadge = 'badge-danger';
            statusLabel = 'Rejected';
          } else if (status === 'Pending') {
            if (isSubmitted) {
              statusLabel = 'Under Admin Review';
            } else {
              statusLabel = 'Pending';
            }
          }

          let actionContent = '';
          if (status === 'Pending') {
            if (!isSubmitted) {
              actionContent = `
                <button class="btn btn-sm btn-primary submit-ben-btn" data-id="${ben._id}" style="padding: 4px 10px; font-size: 0.75rem; background: #2563EB; font-weight: 600;" title="Submit user request to Admin for review">
                  Submit
                </button>
              `;
            } else {
              actionContent = `
                <span class="badge" style="font-size: 0.75rem; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 4px 8px;">
                  Submitted
                </span>
              `;
            }
          } else if (status === 'Active' || status === 'Approved') {
            actionContent = `
              <span style="font-size: 0.75rem; color: #059669; font-weight: 600; padding: 4px 6px;">
                Approved
              </span>
            `;
          } else if (status === 'Rejected') {
            actionContent = `
              <span style="font-size: 0.75rem; color: #DC2626; font-weight: 600; padding: 4px 6px;">
                Rejected
              </span>
            `;
          }

          tr.innerHTML = `
            <td><strong>${cardNo}</strong></td>
            <td>${name}</td>
            <td>${mobile}</td>
            <td>${location}</td>
            <td><strong>${riceQuota}</strong> KG</td>
            <td><strong>${oilQuota}</strong> L</td>
            <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn btn-sm btn-outline view-ben-btn" data-id="${ben._id || index}" title="View Details" style="padding: 4px 8px; font-size: 0.75rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right: 4px; vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View
                </button>
                ${actionContent}
              </div>
            </td>
          `;

          beneficiariesTableBody.appendChild(tr);
        });
      }
    }

    if (beneficiariesCountText) {
      beneficiariesCountText.textContent = `Showing ${filtered.length} of ${assignedBeneficiaries.length} assigned beneficiaries`;
    }

    if (dashTotalBeneficiariesCount) {
      dashTotalBeneficiariesCount.textContent = `${assignedBeneficiaries.length} Families`;
    }
  }

  // Filter Event Listeners
  if (beneficiarySearchInput) beneficiarySearchInput.addEventListener('input', renderBeneficiaries);
  if (villageFilterSelect) villageFilterSelect.addEventListener('change', renderBeneficiaries);
  if (statusFilterSelect) statusFilterSelect.addEventListener('change', renderBeneficiaries);

  // Table Action Event Delegation for Beneficiaries (View Beneficiary Details & Submit)
  if (beneficiariesTableBody) {
    beneficiariesTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.getAttribute('data-id');
      const ben = assignedBeneficiaries.find((b, idx) => (b._id && b._id.toString() === id) || idx.toString() === id);
      if (!ben) return;

      // Handle Submit to Admin Action
      if (btn.classList.contains('submit-ben-btn') || btn.closest('.submit-ben-btn')) {
        const benName = ben.fullName || ben.headOfFamily || 'Beneficiary';
        const cardNo = ben.rationCardNumber || ben.rationCardNo || 'N/A';
        const confirmSubmit = confirm(`Submit application of ${benName} (${cardNo}) to Admin for quota and eligibility review?`);
        if (!confirmSubmit) return;

        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
          const submitRes = await distributorApi.submitBeneficiaryToAdmin(ben._id);
          if (submitRes && submitRes.success) {
            showToast(`Application for ${benName} submitted to Admin successfully.`);
            await loadAssignedBeneficiaries();
          } else {
            showToast(submitRes?.message || 'Failed to submit application. Please retry.', 'error');
            btn.disabled = false;
            btn.textContent = 'Submit';
          }
        } catch (err) {
          console.error('Error submitting beneficiary:', err);
          showToast(err.message || 'Failed to submit application to Admin.', 'error');
          btn.disabled = false;
          btn.textContent = 'Submit';
        }
        return;
      }

      if (btn.classList.contains('view-ben-btn') || btn.closest('.view-ben-btn')) {
        const fpsCode = distributorProfile?.fpsCode || 'FPS-4201';
        const storeName = distributorProfile?.storeName || 'Fair Price Shop';
        const cardNo = ben.rationCardNumber || ben.rationCardNo || 'N/A';
        const name = ben.fullName || ben.headOfFamily || 'Beneficiary';
        const category = ben.cardCategory || ben.cardType || 'PHH';
        const members = ben.familyMemberCount ?? ben.familyMembers ?? 1;
        const location = ben.village || ben.taluk || ben.district || 'Assigned Jurisdiction';
        const mobile = ben.mobileNumber || 'N/A';
        const status = ben.status || 'Active';

        const riceAllowed = ben.riceQuota ?? ben.riceAllowed ?? 0;
        const oilAllowed = ben.oilQuota ?? ben.oilAllowed ?? 0;

        viewBeneficiaryModalContent.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.9rem;">
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Ration Card No</span>
              <div style="font-weight: 700; color: var(--color-primary); font-size: 1rem; margin-top: 2px;">${cardNo}</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Head of Family</span>
              <div style="font-weight: 700; color: var(--color-text-main); font-size: 1rem; margin-top: 2px;">${name}</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Rice Allowed Quota</span>
              <div style="font-weight: 700; color: #16A34A; font-size: 1rem; margin-top: 2px;">${riceAllowed} KG</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Oil Allowed Quota</span>
              <div style="font-weight: 700; color: #D97706; font-size: 1rem; margin-top: 2px;">${oilAllowed} Litres</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Card Category</span>
              <div style="margin-top: 2px;"><span class="badge badge-primary">${category}</span></div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Family Members</span>
              <div style="font-weight: 600; margin-top: 2px;">${members} Members Registered</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Village / Ward</span>
              <div style="font-weight: 600; margin-top: 2px;">${location}</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Mobile Number</span>
              <div style="font-weight: 600; margin-top: 2px;">${mobile}</div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Status</span>
              <div style="margin-top: 2px;"><span class="badge badge-success">${status}</span></div>
            </div>
            <div style="padding: 10px; background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Assigned FPS</span>
              <div style="font-weight: 600; margin-top: 2px;">${fpsCode} (${storeName})</div>
            </div>
          </div>
          <div id="modalBeneficiaryExtraDetails" style="margin-top: 14px; font-size: 0.85rem; color: var(--color-text-muted); text-align: center;">
            FPS Jurisdiction: Bangalore Urban North • Real-time FPS Records
          </div>
        `;
        if (viewBeneficiaryModal) viewBeneficiaryModal.classList.remove('hidden');

        // Attempt background API fetch for enriched details
        if (ben._id) {
          try {
            const detailRes = await distributorApi.getBeneficiaryDetails(ben._id);
            if (detailRes && detailRes.success && detailRes.data) {
              const extraContainer = document.getElementById('modalBeneficiaryExtraDetails');
              if (extraContainer) {
                const totalAlloc = detailRes.data.allocations?.length || 0;
                const totalTxns = detailRes.data.recentTransactions?.length || 0;
                extraContainer.innerHTML = `
                  <div style="display: flex; justify-content: space-around; padding: 8px; background: #F1F5F9; border-radius: var(--radius-sm); margin-top: 6px;">
                    <span><strong>Allocations:</strong> ${totalAlloc} Record(s)</span>
                    <span><strong>Transactions:</strong> ${totalTxns} Disbursed</span>
                  </div>
                `;
              }
            }
          } catch (fetchErr) {
            // Non-blocking
          }
        }
      }
    });
  }

  if (closeViewBeneficiaryModalBtn) closeViewBeneficiaryModalBtn.addEventListener('click', () => viewBeneficiaryModal.classList.add('hidden'));
  if (confirmViewBeneficiaryModalBtn) confirmViewBeneficiaryModalBtn.addEventListener('click', () => viewBeneficiaryModal.classList.add('hidden'));

  // Close modals on backdrop click
  if (viewBeneficiaryModal) {
    viewBeneficiaryModal.addEventListener('click', (e) => {
      if (e.target === viewBeneficiaryModal) viewBeneficiaryModal.classList.add('hidden');
    });
  }
  if (beneficiaryModal) {
    beneficiaryModal.addEventListener('click', (e) => {
      if (e.target === beneficiaryModal) beneficiaryModal.classList.add('hidden');
    });
  }

  // =========================================================================
  // 7. MONTHLY ALLOCATION
  // =========================================================================
  const allocBeneficiarySelect = document.getElementById('allocBeneficiarySelect');
  const allocationForm = document.getElementById('allocationForm');
  const allocationHistoryTableBody = document.getElementById('allocationHistoryTableBody');
  const allocateSubmitBtn = document.getElementById('allocateSubmitBtn');

  function populateAllocationDropdown() {
    if (!allocBeneficiarySelect) return;
    allocBeneficiarySelect.innerHTML = '<option value="">-- Choose Ration Card Beneficiary --</option>';

    assignedBeneficiaries.forEach((b) => {
      const status = b.status || 'Active';
      if (status === 'Active') {
        const opt = document.createElement('option');
        const cardNo = b.rationCardNumber || b.rationCardNo;
        const name = b.fullName || b.headOfFamily;
        const loc = b.village || b.taluk || b.district || '';
        opt.value = b._id;
        opt.textContent = `${name} (${cardNo}${loc ? ` - ${loc}` : ''})`;
        allocBeneficiarySelect.appendChild(opt);
      }
    });
  }

  // Pre-fill default Rice and Oil quotas when selecting a beneficiary in allocation
  if (allocBeneficiarySelect) {
    allocBeneficiarySelect.addEventListener('change', () => {
      const selectedId = allocBeneficiarySelect.value;
      const ben = assignedBeneficiaries.find((b) => b._id && b._id.toString() === selectedId);
      if (ben) {
        const riceInput = document.getElementById('allocRiceInput');
        const oilInput = document.getElementById('allocOilInput');
        if (riceInput && ben.riceQuota !== undefined && ben.riceQuota !== null) {
          riceInput.value = ben.riceQuota;
        }
        if (oilInput && ben.oilQuota !== undefined && ben.oilQuota !== null) {
          oilInput.value = ben.oilQuota;
        }
      }
    });
  }

  async function loadAllocationHistory() {
    try {
      if (allocationHistoryTableBody) {
        allocationHistoryTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 24px; color: #64748B;">
              Loading allocation history...
            </td>
          </tr>
        `;
      }
      const res = await distributorApi.getAllocationHistory();
      if (res && res.success) {
        allocationHistory = res.data || [];
        renderAllocationHistory();
      }
    } catch (err) {
      console.error('Error loading allocation history:', err);
      if (allocationHistoryTableBody) {
        allocationHistoryTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 24px; color: #EF4444;">
              Failed to load allocation history.
            </td>
          </tr>
        `;
      }
    }
  }

  function renderAllocationHistory() {
    if (!allocationHistoryTableBody) return;
    allocationHistoryTableBody.innerHTML = '';

    if (allocationHistory.length === 0) {
      allocationHistoryTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #64748B;">
            No monthly allocation records found for this distributor.
          </td>
        </tr>
      `;
      return;
    }

    allocationHistory.forEach((item) => {
      const tr = document.createElement('tr');
      const benName = item.beneficiary?.fullName || item.beneficiaryName || 'Beneficiary';
      const cardNo = item.beneficiary?.rationCardNumber || item.rationCardNo || 'RC-CARD';
      const rice = item.riceAllocated ?? item.riceQuantity ?? 0;
      const oil = item.oilAllocated ?? item.oilQuantity ?? 0;
      const breakdown = `Rice: ${rice}kg, Oil: ${oil}L`;
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US') : (item.date || 'Today');
      const allocId = item.allocationId || (item._id ? `ALC-${item._id.toString().slice(-6).toUpperCase()}` : 'ALC-NEW');
      const status = item.status || 'Allocated';
      const monthYear = item.month ? `${item.month} ${item.year || ''}`.trim() : (item.month || 'Current Cycle');

      tr.innerHTML = `
        <td><strong>${allocId}</strong></td>
        <td>${benName}</td>
        <td><span class="badge badge-primary">${cardNo}</span></td>
        <td>${breakdown}</td>
        <td>${monthYear}</td>
        <td><span class="badge badge-success">${status}</span></td>
        <td>${dateStr}</td>
      `;
      allocationHistoryTableBody.appendChild(tr);
    });
  }

  // Handle Allocation Form Submit
  if (allocationForm) {
    allocationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const beneficiaryId = allocBeneficiarySelect.value;
      if (!beneficiaryId) {
        alert('Please select a beneficiary family from the dropdown.');
        return;
      }

      const monthVal = document.getElementById('allocMonthSelect').value;
      const [month, yearStr] = monthVal.split(' ');
      const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
      const riceQty = parseFloat(document.getElementById('allocRiceInput').value) || 0;
      const oilQty = parseFloat(document.getElementById('allocOilInput').value) || 0;

      // Validate inventory
      if (riceQty > (currentInventory.riceStock || 0)) {
        alert(`Insufficient Rice stock! Available: ${currentInventory.riceStock || 0} Kg, Requested: ${riceQty} Kg.`);
        return;
      }
      if (oilQty > (currentInventory.oilStock || 0)) {
        alert(`Insufficient Oil stock! Available: ${currentInventory.oilStock || 0} Ltr, Requested: ${oilQty} Ltr.`);
        return;
      }

      if (allocateSubmitBtn) {
        allocateSubmitBtn.disabled = true;
        allocateSubmitBtn.innerHTML = `<span>Authorizing...</span>`;
      }

      try {
        const payload = {
          beneficiaryId,
          month: month || 'August',
          year: year || new Date().getFullYear(),
          riceAllocated: riceQty,
          oilAllocated: oilQty,
        };

        const res = await distributorApi.createAllocation(payload);
        if (res && res.success) {
          showToast('Ration allocation authorized and recorded successfully!');
          allocationForm.reset();
          // Reload all impacted records
          await Promise.all([
            loadInventory(),
            loadAllocationHistory(),
            loadTransactions(),
            loadDashboardData(),
            loadNotifications(),
          ]);
        } else {
          alert(res.message || 'Failed to authorize allocation. Please try again.');
        }
      } catch (err) {
        console.error('Error creating ration allocation:', err);
        alert(err.message || 'Server error occurred while creating allocation.');
      } finally {
        if (allocateSubmitBtn) {
          allocateSubmitBtn.disabled = false;
          allocateSubmitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Authorize & Allocate Ration</span>
          `;
        }
      }
    });
  }

  // =========================================================================
  // 8. INVENTORY MANAGEMENT
  // =========================================================================
  async function loadInventory() {
    try {
      const res = await distributorApi.getInventory();
      if (res && res.success && res.data) {
        currentInventory = {
          riceStock: res.data.riceStock ?? res.data.rice ?? 0,
          oilStock: res.data.oilStock ?? res.data.oil ?? 0,
        };
        updateInventoryUI(currentInventory);
      }
    } catch (err) {
      console.error('Error loading distributor inventory:', err);
    }
  }

  function updateInventoryUI(inv) {
    const invTableBody = document.getElementById('inventoryTableBody');
    const rice = inv.riceStock || 0;
    const oil = inv.oilStock || 0;

    if (invTableBody) {
      invTableBody.innerHTML = '';
      const items = [
        { name: 'Rice Stock', qty: rice, unit: 'Kg', min: 200 },
        { name: 'Edible Oil', qty: oil, unit: 'Liters', min: 50 },
      ];

      items.forEach((item) => {
        const isLow = item.qty < item.min;
        const statusBadge = isLow
          ? '<span class="badge badge-warning">Low Stock Warning</span>'
          : '<span class="badge badge-success">Optimal</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${item.name}</strong></td>
          <td><strong style="font-size: 1.05rem; color: var(--color-primary);">${item.qty}</strong></td>
          <td>${item.unit}</td>
          <td>${item.min} ${item.unit}</td>
          <td>${statusBadge}</td>
          <td>Today, Live Balance</td>
        `;
        invTableBody.appendChild(tr);
      });
    }

    // Update Overview Stats
    const totalStock = rice + oil;
    const statTotalAvailableStock = document.getElementById('statTotalAvailableStock');
    if (statTotalAvailableStock) {
      statTotalAvailableStock.innerHTML = `${totalStock} <span class="unit">Units</span>`;
    }

    const statStockBreakdownSummary = document.getElementById('statStockBreakdownSummary');
    if (statStockBreakdownSummary) {
      statStockBreakdownSummary.textContent = `Rice: ${rice} Kg | Oil: ${oil} Ltr`;
    }
  }

  // =========================================================================
  // 9. DISTRIBUTION RECORDS & TRANSACTIONS
  // =========================================================================
  const distributionTableBody = document.getElementById('distributionTableBody');
  const recentTransactionsTableBody = document.getElementById('recentTransactionsTableBody');
  const distributionSearchInput = document.getElementById('distributionSearchInput');
  const statCollectedToday = document.getElementById('statCollectedToday');
  const statTodayBeneficiaries = document.getElementById('statTodayBeneficiaries');
  const statPendingCollections = document.getElementById('statPendingCollections');

  async function loadTransactions() {
    try {
      if (distributionTableBody) {
        distributionTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
              Loading distribution records...
            </td>
          </tr>
        `;
      }
      const [todayRes, monthlyRes] = await Promise.all([
        distributorApi.getTodayTransactions().catch(() => ({ success: false, data: [] })),
        distributorApi.getMonthlyTransactions().catch(() => ({ success: false, data: [] })),
      ]);

      const todayList = todayRes?.success ? (todayRes.data || []) : [];
      const monthlyList = monthlyRes?.success ? (monthlyRes.data || []) : [];

      // Combine with deduplication
      const map = new Map();
      todayList.forEach((t) => map.set((t._id || t.id).toString(), t));
      monthlyList.forEach((t) => map.set((t._id || t.id).toString(), t));
      distributionRecords = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      renderDistributionRecords();
      updateDashboardTransactionMetrics(todayList);
    } catch (err) {
      console.error('Error loading transactions:', err);
      if (distributionTableBody) {
        distributionTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #EF4444;">
              Failed to load transaction records.
            </td>
          </tr>
        `;
      }
    }
  }

  function updateDashboardTransactionMetrics(todayList) {
    let todayRiceSum = 0;
    let todayOilSum = 0;

    todayList.forEach((txn) => {
      todayRiceSum += txn.riceQuantity || txn.riceAllocated || 0;
      todayOilSum += txn.oilQuantity || txn.oilAllocated || 0;
    });

    if (statCollectedToday) {
      statCollectedToday.innerHTML = `${todayRiceSum} <span class="unit">Kg Rice</span>`;
    }

    if (statTodayBeneficiaries) {
      statTodayBeneficiaries.textContent = `${todayList.length} Families Disbursed`;
    }

    if (statPendingCollections) {
      const activeCount = assignedBeneficiaries.filter((b) => (b.status || 'Active') === 'Active').length;
      const pending = Math.max(0, activeCount - todayList.length);
      statPendingCollections.innerHTML = `${pending} <span class="unit">Families</span>`;
    }
  }

  function renderDistributionRecords() {
    const query = distributionSearchInput ? distributionSearchInput.value.toLowerCase().trim() : '';

    const filtered = distributionRecords.filter((r) => {
      const txnId = (r.transactionId || r._id || '').toLowerCase();
      const benName = (r.beneficiary?.fullName || r.beneficiaryName || '').toLowerCase();
      const cardNo = (r.beneficiary?.rationCardNumber || r.rationCardNo || '').toLowerCase();
      const commodities = `Rice: ${r.riceQuantity || 0}kg, Oil: ${r.oilQuantity || 0}L`.toLowerCase();

      return (
        txnId.includes(query) ||
        benName.includes(query) ||
        cardNo.includes(query) ||
        commodities.includes(query)
      );
    });

    if (distributionTableBody) {
      distributionTableBody.innerHTML = '';
      if (filtered.length === 0) {
        distributionTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
              No distribution transactions found.
            </td>
          </tr>
        `;
      } else {
        filtered.forEach((rec) => {
          const tr = document.createElement('tr');
          const benName = rec.beneficiary?.fullName || rec.beneficiaryName || 'Beneficiary';
          const cardNo = rec.beneficiary?.rationCardNumber || rec.rationCardNo || 'RC-CARD';
          const commodities = `Rice (${rec.riceQuantity || 0}kg), Oil (${rec.oilQuantity || 0}L)`;
          const dateObj = rec.createdAt ? new Date(rec.createdAt) : new Date();
          const dateStr = dateObj.toLocaleDateString('en-US');
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const status = rec.collectionStatus || rec.status || 'Completed';
          const txnId = rec.transactionId || (rec._id ? `TXN-${rec._id.toString().slice(-6).toUpperCase()}` : 'TXN-001');

          tr.innerHTML = `
            <td><strong>${txnId}</strong></td>
            <td>${benName}</td>
            <td><span class="badge badge-primary">${cardNo}</span></td>
            <td>${commodities}</td>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td><span class="badge badge-success">${status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline print-receipt-btn" data-id="${rec._id || txnId}">Print Pass</button>
            </td>
          `;
          distributionTableBody.appendChild(tr);
        });
      }
    }

    // Recent 4 on Dashboard
    if (recentTransactionsTableBody) {
      recentTransactionsTableBody.innerHTML = '';
      const recent4 = distributionRecords.slice(0, 4);

      if (recent4.length === 0) {
        recentTransactionsTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 18px; color: #64748B;">
              No transactions recorded yet today.
            </td>
          </tr>
        `;
      } else {
        recent4.forEach((rec) => {
          const tr = document.createElement('tr');
          const benName = rec.beneficiary?.fullName || rec.beneficiaryName || 'Beneficiary';
          const cardNo = rec.beneficiary?.rationCardNumber || rec.rationCardNo || 'RC-CARD';
          const commodities = `Rice (${rec.riceQuantity || 0}kg), Oil (${rec.oilQuantity || 0}L)`;
          const dateObj = rec.createdAt ? new Date(rec.createdAt) : new Date();
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const status = rec.collectionStatus || rec.status || 'Completed';
          const txnId = rec.transactionId || (rec._id ? `TXN-${rec._id.toString().slice(-6).toUpperCase()}` : 'TXN-001');

          tr.innerHTML = `
            <td><strong>${txnId}</strong></td>
            <td>${benName}</td>
            <td><span class="badge badge-primary">${cardNo}</span></td>
            <td>${commodities}</td>
            <td>${timeStr}</td>
            <td><span class="badge badge-success">${status}</span></td>
          `;
          recentTransactionsTableBody.appendChild(tr);
        });
      }
    }
  }

  if (distributionSearchInput) {
    distributionSearchInput.addEventListener('input', renderDistributionRecords);
  }

  // Print Pass Event Delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('print-receipt-btn')) {
      const id = e.target.getAttribute('data-id');
      const rec = distributionRecords.find((r) => (r._id && r._id.toString() === id) || r.transactionId === id);
      if (rec) {
        const benName = rec.beneficiary?.fullName || rec.beneficiaryName || 'Beneficiary';
        const cardNo = rec.beneficiary?.rationCardNumber || rec.rationCardNo || 'RC-CARD';
        const commodities = `Rice (${rec.riceQuantity || 0}kg), Oil (${rec.oilQuantity || 0}L)`;
        const dateObj = rec.createdAt ? new Date(rec.createdAt) : new Date();
        const dateStr = `${dateObj.toLocaleDateString('en-US')} ${dateObj.toLocaleTimeString('en-US')}`;
        const txnId = rec.transactionId || (rec._id ? `TXN-${rec._id.toString().slice(-6).toUpperCase()}` : 'TXN-001');
        const fpsCode = distributorProfile?.fpsCode || 'FPS-4201';
        const storeName = distributorProfile?.storeName || 'Fair Price Shop';

        alert(
          `FOOD & CIVIL SUPPLIES DEPARTMENT\nFair Price Shop Official Collection Pass\n\nTransaction ID: ${txnId}\nStore Code: ${fpsCode} (${storeName})\nCardholder: ${benName} (${cardNo})\nDisbursed Items: ${commodities}\nDate & Time: ${dateStr}\nStatus: ${rec.collectionStatus || rec.status || 'Completed'}`
        );
      }
    }
  });

  // =========================================================================
  // 10. NOTIFICATIONS
  // =========================================================================
  const feedList = document.getElementById('notificationsFeedList');
  const dropdownList = document.getElementById('notifDropdownList');
  const bellCount = document.getElementById('distNotifBellCount');
  const dropdownBadge = document.getElementById('notifDropdownBadge');
  const sidebarBadge = document.querySelector('.nav-item[data-target="notifications"] .nav-badge');
  const distNotifMarkAllReadBtn = document.getElementById('distNotifMarkAllReadBtn');
  const distNotifClearReadBtn = document.getElementById('distNotifClearReadBtn');
  const distFilterGroup = document.getElementById('distNotifFilterGroup');

  async function loadNotifications() {
    try {
      const res = await distributorApi.getNotifications();
      if (res && res.success) {
        distributorNotifications = res.data || [];
        renderNotifications();
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function renderNotifications() {
    const unreadCount = distributorNotifications.filter((n) => !n.readStatus).length;

    if (bellCount) {
      bellCount.textContent = unreadCount;
      bellCount.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

    if (dropdownBadge) {
      dropdownBadge.textContent = unreadCount === 0 ? '0 New' : `${unreadCount} New`;
    }

    if (sidebarBadge) {
      sidebarBadge.textContent = unreadCount;
      sidebarBadge.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

    let filtered = distributorNotifications;
    if (activeDistNotifFilter === 'unread') {
      filtered = distributorNotifications.filter((n) => !n.readStatus);
    } else if (activeDistNotifFilter === 'read') {
      filtered = distributorNotifications.filter((n) => n.readStatus);
    }

    // 1. Render Main Notifications Feed
    if (feedList) {
      feedList.innerHTML = '';
      if (filtered.length === 0) {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            <p style="font-weight: 600;">No notifications found under '${activeDistNotifFilter.toUpperCase()}' filter.</p>
          </div>
        `;
      } else {
        filtered.forEach((notif) => {
          const item = document.createElement('div');
          const isUnread = !notif.readStatus;
          item.className = `notification-feed-item ${isUnread ? 'unread' : 'read'}`;

          const dateObj = notif.createdAt ? new Date(notif.createdAt) : new Date();
          const dateStr = dateObj.toLocaleDateString('en-US');
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const category = notif.category || 'System Notice';
          const issuer = notif.senderRole ? `${notif.senderRole} Authority` : 'Civil Supplies Admin';

          item.innerHTML = `
            <div class="feed-item-header">
              <span class="feed-title">
                ${isUnread ? '<span class="unread-dot"></span>' : ''}
                ${notif.title || 'Official Notification'}
              </span>
              <span class="badge ${isUnread ? 'badge-unread' : 'badge-read'}">${isUnread ? 'Unread' : 'Read'}</span>
            </div>
            <p class="feed-body">${notif.message || ''}</p>
            ${notif._expanded ? `
              <div class="expanded-detail-box" style="margin: 10px 0; padding: 12px; background: #F8FAFC; border-left: 3px solid #2563EB; border-radius: 6px; font-size: 0.88rem; color: #1E293B; line-height: 1.5;">
                <strong>Full Message:</strong> ${notif.message || ''}
              </div>
            ` : ''}
            <div class="feed-footer">
              <span>Category: ${category} • Issuer: ${issuer}</span>
              <span>📅 ${dateStr} | 🕒 ${timeStr}</span>
            </div>
          `;

          item.addEventListener('click', async () => {
            notif._expanded = !notif._expanded;
            if (isUnread && notif._id) {
              try {
                notif.readStatus = true;
                await distributorApi.markNotificationAsRead(notif._id);
              } catch (e) {
                console.error('Error marking notif read:', e);
              }
            }
            renderNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    // 2. Render Dropdown List
    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = distributorNotifications.slice(0, 5);
      if (recentList.length === 0) {
        dropdownList.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748B;">No notifications</div>';
      } else {
        recentList.forEach((notif) => {
          const item = document.createElement('div');
          const isUnread = !notif.readStatus;
          item.className = `notif-item ${isUnread ? 'unread' : ''}`;
          item.style.padding = '10px 12px';
          item.style.borderBottom = '1px solid #E2E8F0';
          item.style.cursor = 'pointer';

          const dateObj = notif.createdAt ? new Date(notif.createdAt) : new Date();
          const dateStr = dateObj.toLocaleDateString('en-US');
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <strong style="font-size: 0.85rem; color: #0F172A;">${notif.title || 'Notification'}</strong>
              <span class="badge ${isUnread ? 'badge-unread' : 'badge-read'}" style="font-size: 0.68rem;">${isUnread ? 'Unread' : 'Read'}</span>
            </div>
            <p style="font-size: 0.78rem; color: #64748B; margin: 4px 0;">${notif.message || ''}</p>
            <span style="font-size: 0.72rem; color: #94A3B8;">${dateStr}, ${timeStr}</span>
          `;

          item.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (isUnread && notif._id) {
              try {
                notif.readStatus = true;
                await distributorApi.markNotificationAsRead(notif._id);
              } catch (err) {
                console.error('Error marking notif read:', err);
              }
            }
            notif._expanded = true;
            switchSection('notifications');
            renderNotifications();
          });

          dropdownList.appendChild(item);
        });
      }
    }
  }

  // Filter Buttons
  if (distFilterGroup) {
    const filterBtns = distFilterGroup.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeDistNotifFilter = btn.dataset.filter || 'all';
        renderNotifications();
      });
    });
  }

  // Mark All Read
  if (distNotifMarkAllReadBtn) {
    distNotifMarkAllReadBtn.addEventListener('click', async () => {
      try {
        await distributorApi.markAllNotificationsAsRead();
        distributorNotifications.forEach((n) => (n.readStatus = true));
        renderNotifications();
        showToast('All notifications marked as Read.');
      } catch (err) {
        console.error('Error marking all notifications read:', err);
        showToast('Failed to mark all as read.');
      }
    });
  }

  // Clear Read Notifications
  if (distNotifClearReadBtn) {
    distNotifClearReadBtn.addEventListener('click', () => {
      distributorNotifications = distributorNotifications.filter((n) => !n.readStatus);
      renderNotifications();
      showToast('Read notifications cleared from view.');
    });
  }

  // =========================================================================
  // 11. PROFILE & SETTINGS
  // =========================================================================
  const distributorProfileForm = document.getElementById('distributorProfileForm');
  const distributorPasswordForm = document.getElementById('distributorPasswordForm');

  if (distributorProfileForm) {
    distributorProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = document.getElementById('settingFullName').value.trim();
      const storeName = document.getElementById('settingFpsName').value.trim();
      const mobileNumber = document.getElementById('settingMobile').value.trim();
      const email = document.getElementById('settingEmail').value.trim();

      try {
        const res = await distributorApi.updateProfile({
          fullName,
          storeName,
          mobileNumber,
          email,
        });

        if (res && res.success) {
          distributorProfile = res.data || { ...distributorProfile, fullName, storeName, mobileNumber, email };
          updateDistributorProfileUI(distributorProfile);
          showToast('FPS Store & Licensee Profile saved successfully.');
        } else {
          alert(res.message || 'Failed to update profile.');
        }
      } catch (err) {
        console.error('Error updating distributor profile:', err);
        alert(err.message || 'Server error occurred while updating profile.');
      }
    });
  }

  if (distributorPasswordForm) {
    distributorPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById('currentPasswordInput').value;
      const newPassword = document.getElementById('newPasswordInput').value;
      const confirmPassword = document.getElementById('confirmNewPasswordInput').value;

      if (newPassword !== confirmPassword) {
        alert('New password and confirmation do not match.');
        return;
      }

      if (newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
      }

      try {
        const res = await distributorApi.changePassword({
          currentPassword,
          newPassword,
        });

        if (res && res.success) {
          distributorPasswordForm.reset();
          showToast('Distributor security password updated successfully.');
        } else {
          alert(res.message || 'Failed to update password.');
        }
      } catch (err) {
        console.error('Error updating password:', err);
        alert(err.message || 'Server error occurred while changing password.');
      }
    });
  }

  // =========================================================================
  // 12. INITIALIZATION
  // =========================================================================
  await Promise.all([
    loadDashboardData(),
    loadAssignedBeneficiaries(),
    loadInventory(),
    loadAllocationHistory(),
    loadTransactions(),
    loadNotifications(),
  ]);
});
