/**
 * Smart Ration Distribution System - Government Admin Portal Logic
 * Real Backend API Integration
 */

import { authStorage, authApi, adminApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. AUTHENTICATION & SESSION VERIFICATION
  // =========================================================================
  const session = authStorage.getSession();
  const token = authStorage.getToken();

  if (!token || !session || session.role !== 'admin') {
    // If not authenticated as Admin, redirect to login
    window.location.href = 'login.html';
    return;
  }

  // Populate Admin details in UI
  const adminUser = session.user || {};
  const currentAdminName = document.getElementById('currentAdminName');
  const profileAdminName = document.getElementById('profileAdminName');
  const profileAdminRole = document.getElementById('profileAdminRole');
  const profileAdminDistrict = document.getElementById('profileAdminDistrict');

  if (currentAdminName) currentAdminName.textContent = adminUser.name || 'State Admin';
  if (profileAdminName) profileAdminName.textContent = adminUser.name || 'Food & Civil Supplies Officer';
  if (profileAdminRole) profileAdminRole.textContent = `ID: ${adminUser.adminId || 'ADMIN-HQ'}`;
  if (profileAdminDistrict) profileAdminDistrict.textContent = adminUser.district ? `${adminUser.district} HQ` : 'State Central HQ';

  // =========================================================================
  // 2. STATE STORAGE
  // =========================================================================
  let rawDistributors = [];
  let centralInventory = { riceStock: 0, oilStock: 0, minimumStock: 500 };
  let distributorInventories = [];
  let rawDispatches = [];
  let summaryReport = null;
  let transactionsReport = [];

  // Local notifications storage (real system audit & broadcast events)
  let systemNotifications = [
    {
      id: 'SYS-NOTIF-01',
      title: 'Admin Session Authenticated',
      shortMsg: `Administrator ${adminUser.name || 'Admin'} logged in to the Central Command Portal.`,
      fullMsg: `Session established with JWT credential authorization for ${adminUser.adminId || 'ADMIN-HQ'} at State Central Control Center.`,
      date: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Unread',
      category: 'Security Event',
      issuer: 'Auth System',
      expanded: false
    }
  ];

  let activeAdminNotifFilter = 'all';

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
  // 4. NAVIGATION & UI TOGGLES
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
    dashboard: 'Dashboard Overview',
    distributors: 'Distributor Management',
    inventory: 'Central Warehouse Inventory',
    dispatch: 'Stock Dispatch Management',
    reports: 'Reports & Analytics',
    notifications: 'Broadcast & Notifications',
    settings: 'Admin Settings'
  };

  function switchSection(targetKey) {
    if (!sectionTitles[targetKey]) return;

    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetKey) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    contentSections.forEach(sec => {
      if (sec.id === `${targetKey}Section`) {
        sec.classList.remove('hidden');
        sec.classList.add('active');
      } else {
        sec.classList.add('hidden');
        sec.classList.remove('active');
      }
    });

    if (pageTitle) {
      pageTitle.textContent = sectionTitles[targetKey];
    }

    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh specific section data on switch
    if (targetKey === 'distributors') loadDistributors();
    if (targetKey === 'inventory') loadCentralInventory();
    if (targetKey === 'dispatch') loadDispatches();
    if (targetKey === 'reports') loadReports();
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(item.getAttribute('data-target'));
    });
  });

  navTriggers.forEach(trig => {
    trig.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(trig.getAttribute('data-target'));
    });
  });

  // Current Date
  const currentDateText = document.getElementById('currentDateTimeText');
  if (currentDateText) {
    const now = new Date();
    currentDateText.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Dropdown menus
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
    if (confirm('Are you sure you want to log out of the Government Admin Portal?')) {
      authApi.logout();
    }
  }

  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);
  if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);

  // Toast Helper
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
  // 5. DISTRIBUTOR MANAGEMENT
  // =========================================================================
  const distributorsTableBody = document.getElementById('distributorsTableBody');
  const distributorSearchInput = document.getElementById('distributorSearchInput');
  const districtFilterSelect = document.getElementById('districtFilterSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const distributorsCountText = document.getElementById('distributorsCountText');
  const statDistributorsCount = document.getElementById('statDistributorsCount');

  // Modals
  const distributorModal = document.getElementById('distributorModal');
  const openAddDistributorModalBtn = document.getElementById('openAddDistributorModalBtn');
  const closeDistributorModalBtn = document.getElementById('closeDistributorModalBtn');
  const cancelDistributorModalBtn = document.getElementById('cancelDistributorModalBtn');
  const distributorForm = document.getElementById('distributorForm');
  const distributorModalTitle = document.getElementById('distributorModalTitle');

  const viewDistributorModal = document.getElementById('viewDistributorModal');
  const viewModalContent = document.getElementById('viewModalContent');
  const closeViewModalBtn = document.getElementById('closeViewModalBtn');
  const confirmViewModalBtn = document.getElementById('confirmViewModalBtn');

  async function loadDistributors() {
    try {
      const statusVal = statusFilterSelect ? statusFilterSelect.value : 'ALL';
      const districtVal = districtFilterSelect ? districtFilterSelect.value : 'ALL';

      const res = await adminApi.getAllDistributors({
        status: statusVal,
        district: districtVal,
      });

      rawDistributors = res.data || [];
      renderDistributors();
    } catch (err) {
      console.error('Failed to load distributors:', err);
      showToast(`Error loading distributors: ${err.message}`);
    }
  }

  function renderDistributors() {
    const query = distributorSearchInput ? distributorSearchInput.value.toLowerCase().trim() : '';
    const districtFilter = districtFilterSelect ? districtFilterSelect.value : 'ALL';
    const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'ALL';

    const filtered = rawDistributors.filter(d => {
      const dId = (d.distributorId || '').toLowerCase();
      const dName = (d.name || '').toLowerCase();
      const dFps = (d.fpsCode || '').toLowerCase();
      const dDist = (d.district || '').toLowerCase();
      const dTaluk = (d.taluk || '').toLowerCase();

      const matchQuery =
        !query ||
        dId.includes(query) ||
        dName.includes(query) ||
        dFps.includes(query) ||
        dDist.includes(query) ||
        dTaluk.includes(query);

      const matchDistrict = districtFilter === 'ALL' || d.district === districtFilter;
      const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;

      return matchQuery && matchDistrict && matchStatus;
    });

    if (distributorsTableBody) {
      distributorsTableBody.innerHTML = '';

      if (filtered.length === 0) {
        distributorsTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 28px; color: #64748B;">
              No distributor records found matching the criteria.
            </td>
          </tr>
        `;
      } else {
        filtered.forEach((dist) => {
          const tr = document.createElement('tr');
          const distId = dist._id || dist.id;

          let badgeClass = 'badge-primary';
          if (dist.status === 'Active') badgeClass = 'badge-success';
          else if (dist.status === 'Pending') badgeClass = 'badge-warning';
          else if (dist.status === 'Suspended' || dist.status === 'Inactive') badgeClass = 'badge-danger';
          else if (dist.status === 'Rejected') badgeClass = 'badge-danger';

          // Action buttons depending on status
          let actionButtons = `
            <button class="btn-icon view-dist-btn" data-id="${distId}" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          `;

          if (dist.status === 'Pending') {
            actionButtons += `
              <button class="btn btn-sm btn-primary approve-dist-btn" data-id="${distId}" style="padding: 3px 8px; font-size: 0.75rem; background: #059669;" title="Approve Distributor">
                Approve
              </button>
              <button class="btn btn-sm btn-outline reject-dist-btn" data-id="${distId}" style="padding: 3px 8px; font-size: 0.75rem; color: #DC2626; border-color: #DC2626;" title="Reject Distributor">
                Reject
              </button>
            `;
          } else if (dist.status === 'Active') {
            actionButtons += `
              <button class="btn btn-sm btn-outline suspend-dist-btn" data-id="${distId}" style="padding: 3px 8px; font-size: 0.75rem; color: #D97706; border-color: #D97706;" title="Suspend Account">
                Suspend
              </button>
            `;
          } else if (dist.status === 'Suspended' || dist.status === 'Inactive') {
            actionButtons += `
              <button class="btn btn-sm btn-primary activate-dist-btn" data-id="${distId}" style="padding: 3px 8px; font-size: 0.75rem; background: #2563EB;" title="Reactivate Account">
                Activate
              </button>
            `;
          }

          tr.innerHTML = `
            <td><strong>${dist.distributorId || 'N/A'}</strong></td>
            <td>${dist.name || 'Unnamed'}</td>
            <td><span class="badge badge-primary">${dist.fpsCode || 'FPS-N/A'}</span></td>
            <td>${dist.district || 'N/A'}</td>
            <td>${dist.taluk || 'N/A'}</td>
            <td>${dist.mobileNumber || 'N/A'}</td>
            <td><span class="badge ${badgeClass}">${dist.status || 'Pending'}</span></td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                ${actionButtons}
              </div>
            </td>
          `;

          distributorsTableBody.appendChild(tr);
        });
      }
    }

    if (distributorsCountText) {
      distributorsCountText.textContent = `Showing ${filtered.length} of ${rawDistributors.length} registered distributors`;
    }

    if (statDistributorsCount) {
      statDistributorsCount.textContent = rawDistributors.length;
    }

    populateDispatchDistributors();
  }

  // Filter Listeners
  if (distributorSearchInput) distributorSearchInput.addEventListener('input', renderDistributors);
  if (districtFilterSelect) districtFilterSelect.addEventListener('change', loadDistributors);
  if (statusFilterSelect) statusFilterSelect.addEventListener('change', loadDistributors);

  // Add Distributor Modal Handlers
  if (openAddDistributorModalBtn) {
    openAddDistributorModalBtn.addEventListener('click', () => {
      distributorForm.reset();
      const editIdx = document.getElementById('editDistributorIndex');
      if (editIdx) editIdx.value = '-1';
      if (distributorModalTitle) distributorModalTitle.textContent = 'Register Authorized Distributor';
      distributorModal.classList.remove('hidden');
    });
  }

  function closeDistributorModal() {
    if (distributorModal) distributorModal.classList.add('hidden');
  }

  if (closeDistributorModalBtn) closeDistributorModalBtn.addEventListener('click', closeDistributorModal);
  if (cancelDistributorModalBtn) cancelDistributorModalBtn.addEventListener('click', closeDistributorModal);

  // Submit Distributor Registration Form
  if (distributorForm) {
    distributorForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        name: document.getElementById('modalFullName').value.trim(),
        distributorId: document.getElementById('modalDistributorId').value.trim().toUpperCase(),
        fpsCode: document.getElementById('modalFpsCode').value.trim().toUpperCase(),
        mobileNumber: document.getElementById('modalMobile').value.trim(),
        district: document.getElementById('modalDistrict').value,
        taluk: document.getElementById('modalTaluk').value.trim(),
        password: 'Password@123' // default initial secure credential
      };

      try {
        const res = await authApi.registerDistributor(payload);
        showToast(res.message || `Distributor ${payload.distributorId} registered successfully.`);
        closeDistributorModal();
        await loadDistributors();
      } catch (err) {
        showToast(`Registration failed: ${err.message}`);
      }
    });
  }

  // Distributor Table Event Delegation (Approve, Reject, Suspend, Activate, View)
  if (distributorsTableBody) {
    distributorsTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const distId = btn.getAttribute('data-id');
      const dist = rawDistributors.find(d => (d._id || d.id) === distId);
      if (!dist) return;

      // 1. View Details
      if (btn.classList.contains('view-dist-btn')) {
        if (viewModalContent && viewDistributorModal) {
          viewModalContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.9rem;">
              <div><strong>Distributor ID:</strong><br>${dist.distributorId || 'N/A'}</div>
              <div><strong>FPS Code:</strong><br>${dist.fpsCode || 'N/A'}</div>
              <div><strong>Licensee Name:</strong><br>${dist.name || 'N/A'}</div>
              <div><strong>District:</strong><br>${dist.district || 'N/A'}</div>
              <div><strong>Taluk:</strong><br>${dist.taluk || 'N/A'}</div>
              <div><strong>Mobile Number:</strong><br>${dist.mobileNumber || 'N/A'}</div>
              <div><strong>Account Status:</strong><br><span class="badge ${dist.status === 'Active' ? 'badge-success' : 'badge-warning'}">${dist.status || 'Pending'}</span></div>
              <div><strong>Registration Date:</strong><br>${dist.createdAt ? new Date(dist.createdAt).toLocaleDateString() : 'N/A'}</div>
            </div>
          `;
          viewDistributorModal.classList.remove('hidden');
        }
        return;
      }

      // 2. Approve
      if (btn.classList.contains('approve-dist-btn')) {
        if (confirm(`Approve FPS Distributor license for ${dist.name} (${dist.distributorId})?`)) {
          try {
            const res = await adminApi.approveDistributor(distId);
            showToast(res.message || `Distributor ${dist.distributorId} approved.`);
            addSystemNotification('Distributor Approved', `Approved license for ${dist.name} (${dist.fpsCode}).`);
            await loadDistributors();
          } catch (err) {
            showToast(`Approve error: ${err.message}`);
          }
        }
        return;
      }

      // 3. Reject
      if (btn.classList.contains('reject-dist-btn')) {
        if (confirm(`Reject FPS Distributor application for ${dist.name} (${dist.distributorId})?`)) {
          try {
            const res = await adminApi.rejectDistributor(distId);
            showToast(res.message || `Distributor ${dist.distributorId} application rejected.`);
            addSystemNotification('Distributor Rejected', `Rejected application for ${dist.name} (${dist.distributorId}).`);
            await loadDistributors();
          } catch (err) {
            showToast(`Reject error: ${err.message}`);
          }
        }
        return;
      }

      // 4. Suspend
      if (btn.classList.contains('suspend-dist-btn')) {
        if (confirm(`Suspend authorized FPS license for ${dist.name} (${dist.distributorId})?`)) {
          try {
            const res = await adminApi.suspendDistributor(distId);
            showToast(res.message || `Distributor ${dist.distributorId} suspended.`);
            addSystemNotification('Distributor Suspended', `Suspended license for ${dist.name} (${dist.fpsCode}).`);
            await loadDistributors();
          } catch (err) {
            showToast(`Suspend error: ${err.message}`);
          }
        }
        return;
      }

      // 5. Activate
      if (btn.classList.contains('activate-dist-btn')) {
        if (confirm(`Reactivate FPS license for ${dist.name} (${dist.distributorId})?`)) {
          try {
            const res = await adminApi.activateDistributor(distId);
            showToast(res.message || `Distributor ${dist.distributorId} reactivated.`);
            addSystemNotification('Distributor Activated', `Reactivated license for ${dist.name} (${dist.fpsCode}).`);
            await loadDistributors();
          } catch (err) {
            showToast(`Activate error: ${err.message}`);
          }
        }
        return;
      }
    });
  }

  if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', () => viewDistributorModal.classList.add('hidden'));
  if (confirmViewModalBtn) confirmViewModalBtn.addEventListener('click', () => viewDistributorModal.classList.add('hidden'));

  // =========================================================================
  // 6. CENTRAL INVENTORY & RESTOCK
  // =========================================================================
  const restockModal = document.getElementById('restockModal');
  const restockForm = document.getElementById('restockForm');
  const restockCommodityInput = document.getElementById('restockCommodityInput');
  const closeRestockModalBtn = document.getElementById('closeRestockModalBtn');
  const cancelRestockModalBtn = document.getElementById('cancelRestockModalBtn');
  const distributorStockLedgerTableBody = document.getElementById('distributorStockLedgerTableBody');

  async function loadCentralInventory() {
    try {
      const res = await adminApi.getCentralInventory();
      if (res.data) {
        centralInventory = res.data.centralInventory || { riceStock: 0, oilStock: 0, minimumStock: 500 };
        distributorInventories = res.data.distributorInventories || [];
      }
      updateInventoryDisplay();
    } catch (err) {
      console.error('Failed to load central inventory:', err);
    }
  }

  function updateInventoryDisplay() {
    const invRice = document.getElementById('invRiceVal');
    const invOil = document.getElementById('invOilVal');
    const statRice = document.getElementById('statRiceStock');
    const statOil = document.getElementById('statOilStock');

    const riceVal = (centralInventory.riceStock || 0).toLocaleString();
    const oilVal = (centralInventory.oilStock || 0).toLocaleString();

    if (invRice) invRice.textContent = riceVal;
    if (invOil) invOil.textContent = oilVal;

    if (statRice) statRice.innerHTML = `${riceVal} <span class="unit">kg</span>`;
    if (statOil) statOil.innerHTML = `${oilVal} <span class="unit">L</span>`;

    // Render Distributor Stock Reserves Ledger
    if (distributorStockLedgerTableBody) {
      distributorStockLedgerTableBody.innerHTML = '';
      if (distributorInventories.length === 0) {
        distributorStockLedgerTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 24px; color: #64748B;">
              No distributor inventory records available.
            </td>
          </tr>
        `;
      } else {
        distributorInventories.forEach(item => {
          const dist = item.distributor || {};
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${dist.name || 'Unnamed'}</strong></td>
            <td><span class="badge badge-primary">${dist.fpsCode || 'N/A'}</span></td>
            <td>${dist.district || 'N/A'}, ${dist.taluk || 'N/A'}</td>
            <td><strong>${(item.riceStock || 0).toLocaleString()} kg</strong></td>
            <td><strong>${(item.oilStock || 0).toLocaleString()} L</strong></td>
            <td><span class="badge ${dist.status === 'Active' ? 'badge-success' : 'badge-warning'}">${dist.status || 'Active'}</span></td>
          `;
          distributorStockLedgerTableBody.appendChild(tr);
        });
      }
    }
  }

  // Restock modal triggers
  document.querySelectorAll('.restock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const comm = btn.getAttribute('data-commodity');
      if (restockCommodityInput) restockCommodityInput.value = comm;
      if (restockModal) restockModal.classList.remove('hidden');
    });
  });

  function closeRestockModal() {
    if (restockModal) restockModal.classList.add('hidden');
  }

  if (closeRestockModalBtn) closeRestockModalBtn.addEventListener('click', closeRestockModal);
  if (cancelRestockModalBtn) cancelRestockModalBtn.addEventListener('click', closeRestockModal);

  if (restockForm) {
    restockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const comm = restockCommodityInput.value;
      const qty = parseInt(document.getElementById('restockAmountInput').value, 10);

      if (isNaN(qty) || qty <= 0) {
        showToast('Please enter a valid stock amount greater than 0.');
        return;
      }

      try {
        let res;
        if (comm === 'Rice' || comm === 'rice') {
          res = await adminApi.addRiceStock(qty);
        } else {
          res = await adminApi.addOilStock(qty);
        }

        showToast(res.message || `Successfully added ${qty} ${comm === 'Rice' ? 'kg' : 'L'} to Central Warehouse stock.`);
        addSystemNotification('Central Restock Event', `Restocked ${qty} ${comm === 'Rice' ? 'kg' : 'L'} of ${comm}.`);
        closeRestockModal();
        restockForm.reset();
        await loadCentralInventory();
      } catch (err) {
        showToast(`Restock failed: ${err.message}`);
      }
    });
  }

  // =========================================================================
  // 7. STOCK DISPATCH MANAGEMENT
  // =========================================================================
  const dispatchDistributorSelect = document.getElementById('dispatchDistributorSelect');
  const dispatchForm = document.getElementById('dispatchForm');
  const fullDispatchTableBody = document.getElementById('fullDispatchTableBody');
  const recentDispatchesTableBody = document.getElementById('recentDispatchesTableBody');
  const dispatchDateInput = document.getElementById('dispatchDateInput');
  const todayDispatchCount = document.getElementById('todayDispatchCount');
  const statMonthlyDispatches = document.getElementById('statMonthlyDispatches');

  if (dispatchDateInput) {
    dispatchDateInput.value = new Date().toISOString().split('T')[0];
  }

  function populateDispatchDistributors() {
    if (!dispatchDistributorSelect) return;
    dispatchDistributorSelect.innerHTML = '<option value="">-- Choose Authorized FPS Distributor --</option>';

    rawDistributors.forEach(d => {
      if (d.status === 'Active') {
        const opt = document.createElement('option');
        const distId = d._id || d.id;
        opt.value = distId;
        opt.textContent = `${d.name} (${d.fpsCode} - ${d.district})`;
        dispatchDistributorSelect.appendChild(opt);
      }
    });
  }

  async function loadDispatches() {
    try {
      const res = await adminApi.getDispatchHistory();
      rawDispatches = res.data?.dispatchRecords || res.data || [];
      renderDispatches();
    } catch (err) {
      console.error('Failed to load dispatch history:', err);
    }
  }

  function renderDispatches() {
    if (fullDispatchTableBody) {
      fullDispatchTableBody.innerHTML = '';
      if (rawDispatches.length === 0) {
        fullDispatchTableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 24px; color: #64748B;">
              No dispatch records found. Authorize a stock shipment above.
            </td>
          </tr>
        `;
      } else {
        rawDispatches.forEach(disp => {
          const tr = document.createElement('tr');
          const dist = disp.distributor || {};
          const distName = dist.name || disp.distributorName || 'Distributor';
          const fpsCode = dist.fpsCode || disp.fpsCode || 'FPS-HQ';
          const dispDate = disp.dispatchDate ? new Date(disp.dispatchDate).toLocaleDateString() : (disp.date || 'Today');
          const unit = disp.unit || (disp.commodity === 'Oil' || disp.commodity === 'Edible Oil' ? 'L' : 'kg');

          tr.innerHTML = `
            <td><strong>${disp.dispatchId || (disp._id ? disp._id.substring(0, 10) : 'DSP-REC')}</strong></td>
            <td>${distName}</td>
            <td><span class="badge badge-primary">${fpsCode}</span></td>
            <td>${disp.commodity}</td>
            <td><strong>${disp.quantity} ${unit}</strong></td>
            <td>${dispDate}</td>
            <td>${disp.vehicleNumber || 'KA-01-PDS-8800'}</td>
            <td><span class="badge badge-success">${disp.status || 'Dispatched'}</span></td>
            <td>
              <button class="btn btn-sm btn-outline print-pass-btn" data-id="${disp._id || disp.dispatchId}">Stock Pass</button>
            </td>
          `;
          fullDispatchTableBody.appendChild(tr);
        });
      }
    }

    if (recentDispatchesTableBody) {
      recentDispatchesTableBody.innerHTML = '';
      const recent4 = rawDispatches.slice(0, 4);

      if (recent4.length === 0) {
        recentDispatchesTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 20px; color: #64748B;">
              No recent dispatches logged yet.
            </td>
          </tr>
        `;
      } else {
        recent4.forEach(disp => {
          const tr = document.createElement('tr');
          const dist = disp.distributor || {};
          const distName = dist.name || disp.distributorName || 'Distributor';
          const fpsCode = dist.fpsCode || disp.fpsCode || 'FPS-HQ';
          const dispDate = disp.dispatchDate ? new Date(disp.dispatchDate).toLocaleDateString() : (disp.date || 'Today');
          const unit = disp.unit || (disp.commodity === 'Oil' || disp.commodity === 'Edible Oil' ? 'L' : 'kg');

          tr.innerHTML = `
            <td><strong>${disp.dispatchId || (disp._id ? disp._id.substring(0, 10) : 'DSP')}</strong></td>
            <td>${distName}</td>
            <td><span class="badge badge-primary">${fpsCode}</span></td>
            <td>${disp.commodity}</td>
            <td><strong>${disp.quantity} ${unit}</strong></td>
            <td>${dispDate}</td>
            <td><span class="badge badge-success">${disp.status || 'Dispatched'}</span></td>
          `;
          recentDispatchesTableBody.appendChild(tr);
        });
      }
    }

    if (todayDispatchCount) {
      todayDispatchCount.textContent = rawDispatches.length;
    }

    if (statMonthlyDispatches) {
      statMonthlyDispatches.innerHTML = `${rawDispatches.length} <span class="unit">Shipments</span>`;
    }
  }

  if (dispatchForm) {
    dispatchForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const distributorId = dispatchDistributorSelect.value;
      if (!distributorId) {
        showToast('Please select an authorized distributor.');
        return;
      }

      const commodity = document.getElementById('dispatchCommoditySelect').value;
      const quantity = parseInt(document.getElementById('dispatchQuantityInput').value, 10);
      const vehicleNumber = document.getElementById('dispatchVehicleInput')?.value?.trim() || 'KA-01-PDS-8800';

      if (isNaN(quantity) || quantity <= 0) {
        showToast('Please enter a valid dispatch quantity greater than 0.');
        return;
      }

      try {
        let res;
        const payload = { distributorId, quantity, vehicleNumber };

        if (commodity === 'Rice' || commodity === 'rice') {
          res = await adminApi.dispatchRice(payload);
        } else {
          res = await adminApi.dispatchOil(payload);
        }

        showToast(res.message || `Stock shipment dispatched successfully.`);
        addSystemNotification('Stock Shipment Dispatched', `Dispatched ${quantity} ${commodity} to FPS licensee.`);

        dispatchForm.reset();
        if (dispatchDateInput) dispatchDateInput.value = new Date().toISOString().split('T')[0];

        await Promise.all([loadDispatches(), loadCentralInventory()]);
      } catch (err) {
        showToast(`Dispatch error: ${err.message}`);
      }
    });
  }

  // Stock Pass Alert
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('print-pass-btn')) {
      const id = e.target.getAttribute('data-id');
      const disp = rawDispatches.find(d => (d._id === id || d.dispatchId === id));
      if (disp) {
        const dist = disp.distributor || {};
        const distName = dist.name || disp.distributorName || 'Distributor';
        const fpsCode = dist.fpsCode || disp.fpsCode || 'FPS-Store';
        alert(`GOVERNMENT OF KARNATAKA\nDEPARTMENT OF FOOD, CIVIL SUPPLIES & CONSUMER AFFAIRS\n\nOFFICIAL STOCK DISPATCH PASS\n--------------------------------------------\nPass Reference: ${disp.dispatchId || id}\nAuthorized FPS: ${distName} (${fpsCode})\nCommodity: ${disp.quantity} ${disp.commodity}\nVehicle Reg No: ${disp.vehicleNumber || 'KA-01-PDS-8800'}\nDate: ${disp.dispatchDate ? new Date(disp.dispatchDate).toLocaleString() : 'Today'}\nStatus: ${disp.status || 'Dispatched'}\n\n[Digitally Verified by Central Warehouse Command]`);
      }
    }
  });

  // =========================================================================
  // 8. REPORTS & ANALYTICS
  // =========================================================================
  const reportTotalDistributors = document.getElementById('reportTotalDistributors');
  const reportTotalBeneficiaries = document.getElementById('reportTotalBeneficiaries');
  const reportTotalTransactions = document.getElementById('reportTotalTransactions');
  const reportCentralRice = document.getElementById('reportCentralRice');
  const reportCentralOil = document.getElementById('reportCentralOil');
  const reportDistributedRice = document.getElementById('reportDistributedRice');
  const reportPeriodSelect = document.getElementById('reportPeriodSelect');
  const reportDateInput = document.getElementById('reportDateInput');
  const reportsTransactionsTableBody = document.getElementById('reportsTransactionsTableBody');
  const exportDistrictReportBtn = document.getElementById('exportDistrictReportBtn');

  async function loadReports() {
    try {
      // 1. Summary Report
      const summaryRes = await adminApi.getSummaryReport();
      if (summaryRes.data) {
        summaryReport = summaryRes.data;

        if (reportTotalDistributors) reportTotalDistributors.textContent = (summaryReport.totalDistributors || 0).toLocaleString();
        if (reportTotalBeneficiaries) reportTotalBeneficiaries.textContent = (summaryReport.totalBeneficiaries || 0).toLocaleString();
        if (reportTotalTransactions) reportTotalTransactions.textContent = (summaryReport.totalTransactions || 0).toLocaleString();

        const inv = summaryReport.centralInventory || {};
        if (reportCentralRice) reportCentralRice.textContent = `${(inv.riceStock || 0).toLocaleString()} kg`;
        if (reportCentralOil) reportCentralOil.textContent = `${(inv.oilStock || 0).toLocaleString()} L`;

        const dist = summaryReport.totalDistributed || {};
        if (reportDistributedRice) reportDistributedRice.textContent = `${(dist.rice || 0).toLocaleString()} kg (Oil: ${(dist.oil || 0).toLocaleString()} L)`;
      }

      // 2. Transactions Report
      await loadTransactionsReport();
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  }

  async function loadTransactionsReport() {
    try {
      const period = reportPeriodSelect ? reportPeriodSelect.value : 'monthly';
      let res;

      if (period === 'daily') {
        const dateVal = reportDateInput?.value || new Date().toISOString().split('T')[0];
        res = await adminApi.getDailyTransactions(dateVal);
      } else {
        const now = new Date();
        res = await adminApi.getMonthlyTransactions(now.getMonth() + 1, now.getFullYear());
      }

      transactionsReport = res.data?.transactions || res.data || [];
      renderTransactionsReport();
    } catch (err) {
      console.error('Failed to load transactions report:', err);
    }
  }

  function renderTransactionsReport() {
    if (!reportsTransactionsTableBody) return;
    reportsTransactionsTableBody.innerHTML = '';

    if (transactionsReport.length === 0) {
      reportsTransactionsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 28px; color: #64748B;">
            No transactions found for the selected period.
          </td>
        </tr>
      `;
      return;
    }

    transactionsReport.forEach(tx => {
      const tr = document.createElement('tr');
      const b = tx.beneficiary || {};
      const d = tx.distributor || {};
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A';

      tr.innerHTML = `
        <td><strong>${tx.transactionId || (tx._id ? tx._id.substring(0, 10) : 'TXN')}</strong></td>
        <td>${b.fullName || 'Beneficiary'} (${b.rationCardNumber || 'CARD-N/A'})</td>
        <td>${d.name || 'FPS Store'} (${d.fpsCode || 'FPS'})</td>
        <td><strong>${tx.riceQuantity || 0} kg</strong></td>
        <td><strong>${tx.oilQuantity || 0} L</strong></td>
        <td>${dateStr}</td>
        <td><span class="badge badge-success">${tx.status || 'Completed'}</span></td>
      `;
      reportsTransactionsTableBody.appendChild(tr);
    });
  }

  if (reportPeriodSelect) {
    reportPeriodSelect.addEventListener('change', () => {
      if (reportDateInput) {
        reportDateInput.style.display = reportPeriodSelect.value === 'daily' ? 'inline-block' : 'none';
      }
      loadTransactionsReport();
    });
  }

  if (reportDateInput) {
    reportDateInput.addEventListener('change', loadTransactionsReport);
  }

  if (exportDistrictReportBtn) {
    exportDistrictReportBtn.addEventListener('click', () => {
      showToast('Exporting Report CSV to downloads...');
    });
  }

  // =========================================================================
  // 9. BROADCAST & SYSTEM NOTIFICATIONS
  // =========================================================================
  const broadcastNotifForm = document.getElementById('broadcastNotifForm');
  const broadcastHistoryList = document.getElementById('broadcastHistoryList');
  const adminFilterGroup = document.getElementById('adminNotifFilterGroup');
  const adminNotifMarkAllReadBtn = document.getElementById('adminNotifMarkAllReadBtn');
  const adminNotifClearReadBtn = document.getElementById('adminNotifClearReadBtn');

  function addSystemNotification(title, shortMsg, category = 'System Audit') {
    const newNotif = {
      id: `NOTIF-${Date.now()}`,
      title,
      shortMsg,
      fullMsg: shortMsg,
      date: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Unread',
      category,
      issuer: 'Admin HQ',
      expanded: false
    };

    systemNotifications.unshift(newNotif);
    renderAdminNotifications();
  }

  function renderAdminNotifications() {
    const feedList = document.getElementById('adminNotifFeedList');
    const dropdownList = document.getElementById('notifDropdownList');
    const bellCount = document.getElementById('adminNotifBellCount');
    const navBadge = document.getElementById('navNotifBadge');
    const dropdownBadge = document.getElementById('notifDropdownBadge');

    const unreadCount = systemNotifications.filter(n => n.status === 'Unread').length;

    if (bellCount) {
      bellCount.textContent = unreadCount;
      bellCount.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

    if (navBadge) {
      navBadge.textContent = unreadCount;
      navBadge.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

    if (dropdownBadge) {
      dropdownBadge.textContent = unreadCount === 0 ? '0 New' : `${unreadCount} New`;
    }

    let filtered = systemNotifications;
    if (activeAdminNotifFilter === 'unread') {
      filtered = systemNotifications.filter(n => n.status === 'Unread');
    } else if (activeAdminNotifFilter === 'read') {
      filtered = systemNotifications.filter(n => n.status === 'Read');
    }

    if (feedList) {
      feedList.innerHTML = '';
      if (filtered.length === 0) {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: #64748B;">
            <p style="font-weight: 600;">No notifications found under '${activeAdminNotifFilter.toUpperCase()}' filter.</p>
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
                <strong>Full Message:</strong> ${notif.fullMsg}
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
            renderAdminNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = systemNotifications.slice(0, 5);
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
            switchSection('notifications');
            renderAdminNotifications();
          });

          dropdownList.appendChild(item);
        });
      }
    }
  }

  if (adminFilterGroup) {
    const filterBtns = adminFilterGroup.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAdminNotifFilter = btn.dataset.filter || 'all';
        renderAdminNotifications();
      });
    });
  }

  if (adminNotifMarkAllReadBtn) {
    adminNotifMarkAllReadBtn.addEventListener('click', () => {
      systemNotifications.forEach(n => n.status = 'Read');
      renderAdminNotifications();
      showToast('All notifications marked as Read.');
    });
  }

  if (adminNotifClearReadBtn) {
    adminNotifClearReadBtn.addEventListener('click', () => {
      systemNotifications = systemNotifications.filter(n => n.status === 'Unread');
      renderAdminNotifications();
      showToast('Read notifications cleared.');
    });
  }

  // Broadcast Form Submit
  if (broadcastNotifForm) {
    broadcastNotifForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('notifTitleInput').value.trim();
      const target = document.getElementById('notifTargetSelect').value;
      const priority = document.getElementById('notifPrioritySelect').value;
      const message = document.getElementById('notifMessageTextarea').value.trim();

      try {
        let res;
        if (target === 'ALL') {
          res = await adminApi.sendNotificationToAllDistributors({ title, message });
        } else {
          res = await adminApi.sendNotificationToAllDistributors({ title: `[${target}] ${title}`, message });
        }

        const timeStr = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        if (broadcastHistoryList) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'broadcast-history-item';
          itemDiv.innerHTML = `
            <div class="history-item-top">
              <span class="badge ${priority === 'Critical' ? 'badge-danger' : priority === 'Urgent' ? 'badge-warning' : 'badge-primary'}">${priority} Notice</span>
              <span class="history-time">${timeStr}</span>
            </div>
            <h4 class="history-title">${title}</h4>
            <p class="history-body">${message}</p>
            <span class="history-target">Target: ${target === 'ALL' ? 'All Authorized Distributors' : target + ' District'}</span>
          `;
          broadcastHistoryList.prepend(itemDiv);
        }

        addSystemNotification(`Broadcast: ${title}`, message, 'Broadcast Circular');
        broadcastNotifForm.reset();
        showToast(res.message || 'Notification broadcasted successfully.');
      } catch (err) {
        showToast(`Broadcast error: ${err.message}`);
      }
    });
  }

  // =========================================================================
  // 10. INITIALIZATION
  // =========================================================================
  Promise.all([
    loadDistributors(),
    loadCentralInventory(),
    loadDispatches(),
    loadReports()
  ]).then(() => {
    renderAdminNotifications();
  });
});
