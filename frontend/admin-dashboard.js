/**
 * Smart Ration Distribution System - Government Admin Portal Logic
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // INITIAL STATE & DATA STORES
  // =========================================================================

  // Initial Mock Distributors List
  const defaultDistributors = [
    {
      distributorId: 'DIST-8842',
      fullName: 'Ramesh Chandra',
      fpsCode: 'FPS-4201',
      fpsName: 'Sri Annapurna Ration Store',
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      mobileNumber: '9876543210',
      email: 'ramesh.fps@gmail.com',
      status: 'Active'
    },
    {
      distributorId: 'DIST-4021',
      fullName: 'Suresh Kumar',
      fpsCode: 'FPS-1024',
      fpsName: 'Janata Fair Price Depot',
      district: 'Bangalore Rural',
      taluk: 'Devanahalli',
      mobileNumber: '9845012345',
      email: 'suresh.fps@gmail.com',
      status: 'Active'
    },
    {
      distributorId: 'DIST-3012',
      fullName: 'Meenakshi Sundaram',
      fpsCode: 'FPS-8809',
      fpsName: 'Kaveri Co-Op Ration Store',
      district: 'Mysore',
      taluk: 'Mysore South',
      mobileNumber: '9900112233',
      email: 'meenakshi.pds@gmail.com',
      status: 'Active'
    },
    {
      distributorId: 'DIST-1092',
      fullName: 'Basavaraj Patil',
      fpsCode: 'FPS-5512',
      fpsName: 'Gramin Sahakari Sangha',
      district: 'Belagavi',
      taluk: 'Chikodi',
      mobileNumber: '9448123456',
      email: 'basavaraj.p@gmail.com',
      status: 'Pending'
    },
    {
      distributorId: 'DIST-6045',
      fullName: 'Mohammed Farooq',
      fpsCode: 'FPS-9932',
      fpsName: 'Bismillah Ration Distribution',
      district: 'Kalaburagi',
      taluk: 'Gulbarga City',
      mobileNumber: '9741234567',
      email: 'farooq.pds@gmail.com',
      status: 'Active'
    },
    {
      distributorId: 'DIST-7721',
      fullName: 'Ananth Hegde',
      fpsCode: 'FPS-3310',
      fpsName: 'Coastal PDS Outlet',
      district: 'Mangalore',
      taluk: 'Bantwal',
      mobileNumber: '9880123987',
      email: 'hegde.fps@gmail.com',
      status: 'Inactive'
    }
  ];

  // Load state or load from LocalStorage
  let registeredDistributors = loadDistributors();

  // Inventory State
  let inventoryState = {
    Rice: 45200,
    'Edible Oil': 8600
  };

  // Dispatch Ledger History
  let dispatchesList = [
    {
      id: 'DSP-2026-901',
      distributorName: 'Ramesh Chandra',
      fpsCode: 'FPS-4201',
      commodity: 'Rice',
      quantity: 50,
      unit: 'Qtl',
      date: '2026-08-01',
      vehicle: 'KA-01-GA-8842',
      status: 'Delivered'
    },
    {
      id: 'DSP-2026-902',
      distributorName: 'Suresh Kumar',
      fpsCode: 'FPS-1024',
      commodity: 'Rice',
      quantity: 35,
      unit: 'Qtl',
      date: '2026-08-01',
      vehicle: 'KA-53-E-1029',
      status: 'Dispatched'
    },
    {
      id: 'DSP-2026-904',
      distributorName: 'Mohammed Farooq',
      fpsCode: 'FPS-9932',
      commodity: 'Edible Oil',
      quantity: 200,
      unit: 'Ltr',
      date: '2026-08-02',
      vehicle: 'KA-32-F-9012',
      status: 'Pending'
    }
  ];

  function loadDistributors() {
    const saved = localStorage.getItem('ration_registered_distributors');
    if (!saved) return defaultDistributors;
    try {
      const parsed = JSON.parse(saved);
      // Merge unique
      const combined = [...defaultDistributors];
      parsed.forEach(p => {
        if (!combined.some(c => c.distributorId === p.distributorId)) {
          combined.unshift({
            distributorId: p.distributorId || 'DIST-NEW',
            fullName: p.fullName || 'New Licensee',
            fpsCode: p.fpsCode || 'FPS-' + Math.floor(1000 + Math.random() * 9000),
            fpsName: p.fpsName || 'Fair Price Store',
            district: p.district || 'Bangalore Urban',
            taluk: p.taluk || 'Central',
            mobileNumber: p.mobileNumber || '9999999999',
            email: p.email || 'licensee@pds.gov.in',
            status: 'Active'
          });
        }
      });
      return combined;
    } catch (e) {
      return defaultDistributors;
    }
  }

  function saveDistributors() {
    localStorage.setItem('ration_admin_distributors_cache', JSON.stringify(registeredDistributors));
  }

  // =========================================================================
  // DOM ELEMENTS
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
  // SIDEBAR & NAVIGATION TOGGLE
  // =========================================================================

  // Desktop Sidebar Collapse Toggle
  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Mobile Menu Drawer Toggle
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    sidebarBackdrop.classList.add('mobile-open');
  });

  sidebarBackdrop.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('mobile-open');
  });

  // Tab Section Switching
  const sectionTitles = {
    dashboard: 'Dashboard Overview',
    distributors: 'Distributor Management',
    inventory: 'Warehouse Inventory',
    dispatch: 'Dispatch Management',
    reports: 'Reports & Analytics',
    notifications: 'Broadcast Notifications',
    settings: 'Admin Settings'
  };

  function switchSection(targetKey) {
    if (!sectionTitles[targetKey]) return;

    // Update active nav item
    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetKey) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update visible section
    contentSections.forEach(sec => {
      if (sec.id === `${targetKey}Section`) {
        sec.classList.remove('hidden');
        sec.classList.add('active');
      } else {
        sec.classList.add('hidden');
        sec.classList.remove('active');
      }
    });

    // Update page title
    if (pageTitle) {
      pageTitle.textContent = sectionTitles[targetKey];
    }

    // Close mobile menu if open
    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('mobile-open');

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetKey = item.getAttribute('data-target');
      switchSection(targetKey);
    });
  });

  navTriggers.forEach(trig => {
    trig.addEventListener('click', (e) => {
      e.preventDefault();
      const targetKey = trig.getAttribute('data-target');
      switchSection(targetKey);
    });
  });

  // =========================================================================
  // DROPDOWNS & DATE DISPLAY
  // =========================================================================

  // Current Date Display
  const currentDateText = document.getElementById('currentDateTimeText');
  if (currentDateText) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    currentDateText.textContent = now.toLocaleDateString('en-US', options);
  }

  // Toggle Notification Dropdown
  topNotifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('hidden');
    profileMenu.classList.add('hidden');
  });

  // Toggle Profile Dropdown
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('hidden');
    notifDropdown.classList.add('hidden');
  });

  document.addEventListener('click', () => {
    notifDropdown.classList.add('hidden');
    profileMenu.classList.add('hidden');
  });

  notifDropdown.addEventListener('click', (e) => e.stopPropagation());
  profileMenu.addEventListener('click', (e) => e.stopPropagation());

  // Logout Handlers
  function handleLogout() {
    if (confirm('Are you sure you want to log out of the Government Admin Portal?')) {
      localStorage.removeItem('ration_auth_session');
      window.location.href = 'login.html';
    }
  }

  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);
  if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);

  // Toast Alert Notification Helper
  function showToast(message, duration = 3000) {
    toastMsg.textContent = message;
    toastAlert.classList.remove('hidden');
    setTimeout(() => {
      toastAlert.classList.add('hidden');
    }, duration);
  }

  toastCloseBtn.addEventListener('click', () => toastAlert.classList.add('hidden'));

  // =========================================================================
  // DISTRIBUTOR MANAGEMENT LOGIC
  // =========================================================================
  const distributorsTableBody = document.getElementById('distributorsTableBody');
  const distributorSearchInput = document.getElementById('distributorSearchInput');
  const districtFilterSelect = document.getElementById('districtFilterSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const distributorsCountText = document.getElementById('distributorsCountText');
  const statDistributorsCount = document.getElementById('statDistributorsCount');

  // Modal elements
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

  function renderDistributors() {
    const query = distributorSearchInput.value.toLowerCase().trim();
    const districtFilter = districtFilterSelect.value;
    const statusFilter = statusFilterSelect.value;

    const filtered = registeredDistributors.filter(d => {
      const matchQuery =
        d.distributorId.toLowerCase().includes(query) ||
        d.fullName.toLowerCase().includes(query) ||
        d.fpsCode.toLowerCase().includes(query) ||
        d.district.toLowerCase().includes(query);

      const matchDistrict = districtFilter === 'ALL' || d.district === districtFilter;
      const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;

      return matchQuery && matchDistrict && matchStatus;
    });

    if (distributorsTableBody) {
      distributorsTableBody.innerHTML = '';

      if (filtered.length === 0) {
        distributorsTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
              No distributor records found matching your filters.
            </td>
          </tr>
        `;
      } else {
        filtered.forEach((dist, idx) => {
          const originalIndex = registeredDistributors.indexOf(dist);
          const tr = document.createElement('tr');

          let badgeClass = 'badge-primary';
          if (dist.status === 'Active') badgeClass = 'badge-success';
          if (dist.status === 'Pending') badgeClass = 'badge-warning';
          if (dist.status === 'Inactive') badgeClass = 'badge-danger';

          tr.innerHTML = `
            <td><strong>${dist.distributorId}</strong></td>
            <td>${dist.fullName}</td>
            <td><span class="badge badge-primary">${dist.fpsCode}</span></td>
            <td>${dist.district}</td>
            <td>${dist.taluk}</td>
            <td>${dist.mobileNumber}</td>
            <td><span class="badge ${badgeClass}">${dist.status}</span></td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon view-dist-btn" data-index="${originalIndex}" title="View Details">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon edit-dist-btn" data-index="${originalIndex}" title="Edit Distributor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon toggle-status-btn" data-index="${originalIndex}" title="Toggle Active / Inactive">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </button>
              </div>
            </td>
          `;

          distributorsTableBody.appendChild(tr);
        });
      }
    }

    if (distributorsCountText) {
      distributorsCountText.textContent = `Showing ${filtered.length} of ${registeredDistributors.length} registered distributors`;
    }

    if (statDistributorsCount) {
      statDistributorsCount.textContent = registeredDistributors.length;
    }

    // Populate Distributor option dropdown in Dispatch Form
    populateDispatchDistributors();
  }

  // Filter Listeners
  if (distributorSearchInput) distributorSearchInput.addEventListener('input', renderDistributors);
  if (districtFilterSelect) districtFilterSelect.addEventListener('change', renderDistributors);
  if (statusFilterSelect) statusFilterSelect.addEventListener('change', renderDistributors);

  // Add / Edit Modal Controls
  openAddDistributorModalBtn.addEventListener('click', () => {
    distributorForm.reset();
    document.getElementById('editDistributorIndex').value = '-1';
    distributorModalTitle.textContent = 'Add Authorized Distributor';
    distributorModal.classList.remove('hidden');
  });

  function closeDistributorModal() {
    distributorModal.classList.add('hidden');
  }

  closeDistributorModalBtn.addEventListener('click', closeDistributorModal);
  cancelDistributorModalBtn.addEventListener('click', closeDistributorModal);

  // Submit Add/Edit Distributor
  distributorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editIdx = parseInt(document.getElementById('editDistributorIndex').value, 10);

    const distObj = {
      distributorId: document.getElementById('modalDistributorId').value.trim().toUpperCase(),
      fullName: document.getElementById('modalFullName').value.trim(),
      fpsCode: document.getElementById('modalFpsCode').value.trim().toUpperCase(),
      fpsName: document.getElementById('modalFpsName').value.trim(),
      district: document.getElementById('modalDistrict').value,
      taluk: document.getElementById('modalTaluk').value.trim(),
      mobileNumber: document.getElementById('modalMobile').value.trim(),
      email: `${document.getElementById('modalDistributorId').value.trim().toLowerCase()}@pds.gov.in`,
      status: document.getElementById('modalStatus').value
    };

    if (editIdx >= 0) {
      registeredDistributors[editIdx] = distObj;
      showToast(`Updated distributor details for ${distObj.distributorId}`);
    } else {
      registeredDistributors.unshift(distObj);
      showToast(`Added new authorized distributor ${distObj.distributorId}`);
    }

    saveDistributors();
    renderDistributors();
    closeDistributorModal();
  });

  // Table Action Event Delegation
  distributorsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const index = parseInt(btn.getAttribute('data-index'), 10);
    if (isNaN(index) || !registeredDistributors[index]) return;

    const dist = registeredDistributors[index];

    if (btn.classList.contains('view-dist-btn')) {
      viewModalContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.9rem;">
          <div><strong>Distributor ID:</strong><br>${dist.distributorId}</div>
          <div><strong>FPS Code:</strong><br>${dist.fpsCode}</div>
          <div><strong>Licensee Name:</strong><br>${dist.fullName}</div>
          <div><strong>FPS Shop Name:</strong><br>${dist.fpsName}</div>
          <div><strong>District:</strong><br>${dist.district}</div>
          <div><strong>Taluk:</strong><br>${dist.taluk}</div>
          <div><strong>Mobile Number:</strong><br>${dist.mobileNumber}</div>
          <div><strong>Official Email:</strong><br>${dist.email}</div>
          <div><strong>Account Status:</strong><br><span class="badge badge-success">${dist.status}</span></div>
          <div><strong>Authorized Quota:</strong><br>250 Quintals / Mo</div>
        </div>
      `;
      viewDistributorModal.classList.remove('hidden');
    }

    if (btn.classList.contains('edit-dist-btn')) {
      document.getElementById('editDistributorIndex').value = index;
      document.getElementById('modalDistributorId').value = dist.distributorId;
      document.getElementById('modalFullName').value = dist.fullName;
      document.getElementById('modalFpsCode').value = dist.fpsCode;
      document.getElementById('modalFpsName').value = dist.fpsName;
      document.getElementById('modalDistrict').value = dist.district;
      document.getElementById('modalTaluk').value = dist.taluk;
      document.getElementById('modalMobile').value = dist.mobileNumber;
      document.getElementById('modalStatus').value = dist.status;

      distributorModalTitle.textContent = 'Edit Distributor Account';
      distributorModal.classList.remove('hidden');
    }

    if (btn.classList.contains('toggle-status-btn')) {
      dist.status = dist.status === 'Active' ? 'Inactive' : 'Active';
      saveDistributors();
      renderDistributors();
      showToast(`Toggled ${dist.distributorId} status to ${dist.status}`);
    }
  });

  closeViewModalBtn.addEventListener('click', () => viewDistributorModal.classList.add('hidden'));
  confirmViewModalBtn.addEventListener('click', () => viewDistributorModal.classList.add('hidden'));

  // =========================================================================
  // WAREHOUSE INVENTORY & RESTOCK
  // =========================================================================
  const restockModal = document.getElementById('restockModal');
  const restockForm = document.getElementById('restockForm');
  const restockCommodityInput = document.getElementById('restockCommodityInput');
  const closeRestockModalBtn = document.getElementById('closeRestockModalBtn');
  const cancelRestockModalBtn = document.getElementById('cancelRestockModalBtn');

  // Restock modal triggers
  document.querySelectorAll('.restock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const comm = btn.getAttribute('data-commodity');
      restockCommodityInput.value = comm;
      restockModal.classList.remove('hidden');
    });
  });

  closeRestockModalBtn.addEventListener('click', () => restockModal.classList.add('hidden'));
  cancelRestockModalBtn.addEventListener('click', () => restockModal.classList.add('hidden'));

  restockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const comm = restockCommodityInput.value;
    const qty = parseInt(document.getElementById('restockAmountInput').value, 10);

    if (inventoryState[comm] !== undefined && !isNaN(qty)) {
      inventoryState[comm] += qty;
      updateInventoryDisplay();
      showToast(`Successfully added ${qty} to ${comm} warehouse reserve.`);
    }

    restockForm.reset();
    restockModal.classList.add('hidden');
  });

  function updateInventoryDisplay() {
    // Inventory section values
    const invRice = document.getElementById('invRiceVal');
    const invOil = document.getElementById('invOilVal');

    if (invRice && inventoryState.Rice !== undefined) invRice.textContent = inventoryState.Rice.toLocaleString();
    if (invOil && inventoryState['Edible Oil'] !== undefined) invOil.textContent = inventoryState['Edible Oil'].toLocaleString();

    // Dashboard stat cards
    const statRice = document.getElementById('statRiceStock');
    const statOil = document.getElementById('statOilStock');

    if (statRice && inventoryState.Rice !== undefined) statRice.innerHTML = `${inventoryState.Rice.toLocaleString()} <span class="unit">Qtl</span>`;
    if (statOil && inventoryState['Edible Oil'] !== undefined) statOil.innerHTML = `${inventoryState['Edible Oil'].toLocaleString()} <span class="unit">Ltr</span>`;
  }

  // =========================================================================
  // DISPATCH MANAGEMENT LOGIC
  // =========================================================================
  const dispatchDistributorSelect = document.getElementById('dispatchDistributorSelect');
  const dispatchForm = document.getElementById('dispatchForm');
  const fullDispatchTableBody = document.getElementById('fullDispatchTableBody');
  const recentDispatchesTableBody = document.getElementById('recentDispatchesTableBody');

  // Set default dispatch date input to today
  const dispatchDateInput = document.getElementById('dispatchDateInput');
  if (dispatchDateInput) {
    const today = new Date().toISOString().split('T')[0];
    dispatchDateInput.value = today;
  }

  function populateDispatchDistributors() {
    if (!dispatchDistributorSelect) return;
    dispatchDistributorSelect.innerHTML = '<option value="">-- Choose FPS Distributor --</option>';

    registeredDistributors.forEach(d => {
      if (d.status === 'Active') {
        const opt = document.createElement('option');
        opt.value = `${d.fullName}|${d.fpsCode}`;
        opt.textContent = `${d.fullName} (${d.fpsCode} - ${d.district})`;
        dispatchDistributorSelect.appendChild(opt);
      }
    });
  }

  function renderDispatches() {
    // Render full table
    if (fullDispatchTableBody) {
      fullDispatchTableBody.innerHTML = '';
      dispatchesList.forEach(disp => {
        const tr = document.createElement('tr');
        let badge = 'badge-primary';
        if (disp.status === 'Delivered') badge = 'badge-success';
        if (disp.status === 'Dispatched') badge = 'badge-info';
        if (disp.status === 'Pending') badge = 'badge-warning';

        tr.innerHTML = `
          <td><strong>${disp.id}</strong></td>
          <td>${disp.distributorName}</td>
          <td><span class="badge badge-primary">${disp.fpsCode}</span></td>
          <td>${disp.commodity}</td>
          <td><strong>${disp.quantity} ${disp.unit}</strong></td>
          <td>${disp.date}</td>
          <td>${disp.vehicle || 'N/A'}</td>
          <td><span class="badge ${badge}">${disp.status}</span></td>
          <td>
            <button class="btn btn-sm btn-outline print-pass-btn" data-id="${disp.id}">Stock Pass</button>
          </td>
        `;
        fullDispatchTableBody.appendChild(tr);
      });
    }

    // Render recent 3 dispatches on main dashboard table
    if (recentDispatchesTableBody) {
      recentDispatchesTableBody.innerHTML = '';
      const recent3 = dispatchesList.slice(0, 4);

      recent3.forEach(disp => {
        const tr = document.createElement('tr');
        let badge = 'badge-primary';
        if (disp.status === 'Delivered') badge = 'badge-success';
        if (disp.status === 'Dispatched') badge = 'badge-info';
        if (disp.status === 'Pending') badge = 'badge-warning';

        tr.innerHTML = `
          <td><strong>${disp.id}</strong></td>
          <td>${disp.distributorName}</td>
          <td><span class="badge badge-primary">${disp.fpsCode}</span></td>
          <td>${disp.commodity}</td>
          <td><strong>${disp.quantity} ${disp.unit}</strong></td>
          <td>${disp.date}</td>
          <td><span class="badge ${badge}">${disp.status}</span></td>
        `;
        recentDispatchesTableBody.appendChild(tr);
      });
    }
  }

  if (dispatchForm) {
    dispatchForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const distVal = dispatchDistributorSelect.value;
      if (!distVal) {
        alert('Please select a distributor.');
        return;
      }

      const [distName, fpsCode] = distVal.split('|');
      const commodity = document.getElementById('dispatchCommoditySelect').value;
      const quantity = parseInt(document.getElementById('dispatchQuantityInput').value, 10);
      const date = dispatchDateInput.value;
      const status = document.getElementById('dispatchStatusSelect').value;
      const vehicle = document.getElementById('dispatchVehicleInput').value.trim().toUpperCase() || 'KA-01-PDS-8800';

      const unit = commodity === 'Edible Oil' ? 'Ltr' : 'Qtl';

      // Decrement Inventory if available
      if (inventoryState[commodity] !== undefined) {
        inventoryState[commodity] = Math.max(0, inventoryState[commodity] - quantity);
        updateInventoryDisplay();
      }

      const newDispatch = {
        id: `DSP-2026-${Math.floor(100 + Math.random() * 900)}`,
        distributorName: distName,
        fpsCode: fpsCode,
        commodity: commodity,
        quantity: quantity,
        unit: unit,
        date: date,
        vehicle: vehicle,
        status: status
      };

      dispatchesList.unshift(newDispatch);
      renderDispatches();

      dispatchForm.reset();
      dispatchDateInput.value = new Date().toISOString().split('T')[0];

      showToast(`Stock shipment ${newDispatch.id} authorized & dispatched to ${fpsCode}.`);
    });
  }

  // Print Pass Event Delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('print-pass-btn')) {
      const id = e.target.getAttribute('data-id');
      const disp = dispatchesList.find(d => d.id === id);
      if (disp) {
        alert(`STATE FOOD & CIVIL SUPPLIES DEPARTMENT\nOfficial Stock Dispatch Pass\n\nPass ID: ${disp.id}\nDistributor: ${disp.distributorName} (${disp.fpsCode})\nCommodity: ${disp.quantity} ${disp.unit} of ${disp.commodity}\nVehicle Reg No: ${disp.vehicle}\nDate: ${disp.date}\nStatus: ${disp.status}`);
      }
    }
  });

  // Export Buttons Simulation
  const exportDispatchBtn = document.getElementById('exportDispatchBtn');
  if (exportDispatchBtn) {
    exportDispatchBtn.addEventListener('click', () => {
      showToast('Downloading Official Stock Dispatch Ledger (CSV)...');
    });
  }

  const exportDistrictReportBtn = document.getElementById('exportDistrictReportBtn');
  if (exportDistrictReportBtn) {
    exportDistrictReportBtn.addEventListener('click', () => {
      showToast('Downloading District-wise Allocation Report (CSV)...');
    });
  }

  // =========================================================================
  // SYSTEM NOTIFICATIONS ENGINE (Pure In-Memory JS)
  // =========================================================================
  let adminNotifications = [
    {
      id: 'ADM-NOTIF-101',
      title: 'New Distributor Registration Request',
      shortMsg: 'License application submitted by Basavaraj Patil (DIST-1092) for Belagavi District.',
      fullMsg: 'Licensee Basavaraj Patil (DIST-1092) has submitted a formal FPS license registration request for Belagavi district. Verification documents (Aadhaar, Store Ownership, Bank NOC) have been uploaded for departmental audit.',
      date: '03 Aug 2026',
      time: '09:15 AM',
      status: 'Unread',
      category: 'Registration Request',
      issuer: 'System Audit Portal',
      expanded: false
    },
    {
      id: 'ADM-NOTIF-102',
      title: 'Monthly Stock Dispatch Completed',
      shortMsg: '50 Qtl Rice & 35 Qtl Wheat successfully dispatched to FPS-4201.',
      fullMsg: 'Central Warehouse Depot #2 has completed dispatch for consignment DSP-2026-901 allocated to Sri Annapurna Ration Store (FPS-4201). Transport vehicle KA-01-GA-8842 has departed.',
      date: '03 Aug 2026',
      time: '08:30 AM',
      status: 'Unread',
      category: 'Stock Dispatch',
      issuer: 'Depot Manager #2',
      expanded: false
    },
    {
      id: 'ADM-NOTIF-103',
      title: 'Low Warehouse Stock Warning',
      shortMsg: 'Sugar stock at Central Depot #4 reached minimum threshold (12,400 Qtl).',
      fullMsg: 'Central Warehouse Sugar reserves have dropped to 12,400 Quintals, reaching the safety threshold of 15,000 Quintals. Re-indentment recommended from Karnataka State Food Corporation.',
      date: '02 Aug 2026',
      time: '04:45 PM',
      status: 'Unread',
      category: 'Stock Warning',
      issuer: 'Warehouse Monitor',
      expanded: false
    },
    {
      id: 'ADM-NOTIF-104',
      title: 'Distributor Account Approved',
      shortMsg: 'Account for Ramesh Chandra (FPS-4201) activated after verification.',
      fullMsg: 'Government admin approved the renewal application for Ramesh Chandra (DIST-8842, FPS-4201). e-POS authorization keys re-issued and active for August cycle.',
      date: '02 Aug 2026',
      time: '11:20 AM',
      status: 'Read',
      category: 'Account Approval',
      issuer: 'State Admin Office',
      expanded: false
    },
    {
      id: 'ADM-NOTIF-105',
      title: 'System Maintenance Alert',
      shortMsg: 'Scheduled e-POS server database patch update on Sunday at 02:00 AM.',
      fullMsg: 'State PDS Data Center will undergo routine server maintenance on Sunday between 02:00 AM and 04:00 AM IST. e-POS terminal syncing will be paused during this window.',
      date: '01 Aug 2026',
      time: '06:00 PM',
      status: 'Read',
      category: 'System Maintenance',
      issuer: 'IT Operations Desk',
      expanded: false
    },
    {
      id: 'ADM-NOTIF-106',
      title: 'Daily Distribution Report Available',
      shortMsg: 'Consolidated August 2, 2026 district disbursement summary ready.',
      fullMsg: 'The automated daily distribution ledger report for all 31 districts has been compiled. Total 1,42,850 Quintals commodities disbursed across 8,420 Fair Price Shops.',
      date: '01 Aug 2026',
      time: '09:00 PM',
      status: 'Read',
      category: 'Daily Report',
      issuer: 'PDS Analytics Engine',
      expanded: false
    }
  ];

  let activeAdminNotifFilter = 'all';

  function renderAdminNotifications() {
    const feedList = document.getElementById('adminNotifFeedList');
    const dropdownList = document.getElementById('notifDropdownList');
    const bellCount = document.getElementById('adminNotifBellCount');
    const navBadge = document.getElementById('navNotifBadge');
    const dropdownBadge = document.getElementById('notifDropdownBadge');

    const unreadCount = adminNotifications.filter(n => n.status === 'Unread').length;

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
      dropdownBadge.textContent = unreadCount === 0 ? '0 New' : `${unreadCount} New`;
    }

    // Filter list
    let filtered = adminNotifications;
    if (activeAdminNotifFilter === 'unread') {
      filtered = adminNotifications.filter(n => n.status === 'Unread');
    } else if (activeAdminNotifFilter === 'read') {
      filtered = adminNotifications.filter(n => n.status === 'Read');
    }

    // 1. Render Main Notifications Feed List
    if (feedList) {
      feedList.innerHTML = '';
      if (filtered.length === 0) {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            <p style="font-weight: 600;">No notifications found under '${activeAdminNotifFilter.toUpperCase()}' filter.</p>
          </div>
        `;
      } else {
        filtered.forEach(notif => {
          const item = document.createElement('div');
          item.className = `notification-feed-item ${notif.status === 'Unread' ? 'unread' : 'read'}`;
          item.dataset.id = notif.id;

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
            renderAdminNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    // 2. Render Top Dropdown List
    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = adminNotifications.slice(0, 5);
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

  // Filter Buttons Handler
  const adminFilterGroup = document.getElementById('adminNotifFilterGroup');
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

  // Mark All as Read
  const adminNotifMarkAllReadBtn = document.getElementById('adminNotifMarkAllReadBtn');
  if (adminNotifMarkAllReadBtn) {
    adminNotifMarkAllReadBtn.addEventListener('click', () => {
      adminNotifications.forEach(n => n.status = 'Read');
      renderAdminNotifications();
      showToast('All notifications marked as Read.');
    });
  }

  // Clear Read Notifications
  const adminNotifClearReadBtn = document.getElementById('adminNotifClearReadBtn');
  if (adminNotifClearReadBtn) {
    adminNotifClearReadBtn.addEventListener('click', () => {
      adminNotifications = adminNotifications.filter(n => n.status === 'Unread');
      renderAdminNotifications();
      showToast('Read notifications cleared.');
    });
  }

  // =========================================================================
  // BROADCAST NOTIFICATIONS LOGIC
  // =========================================================================
  const broadcastNotifForm = document.getElementById('broadcastNotifForm');
  const broadcastHistoryList = document.getElementById('broadcastHistoryList');

  if (broadcastNotifForm) {
    broadcastNotifForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('notifTitleInput').value.trim();
      const target = document.getElementById('notifTargetSelect').value;
      const priority = document.getElementById('notifPrioritySelect').value;
      const message = document.getElementById('notifMessageTextarea').value.trim();

      let badgeClass = 'badge-primary';
      if (priority === 'Urgent') badgeClass = 'badge-warning';
      if (priority === 'Critical') badgeClass = 'badge-danger';

      const timeStr = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const itemDiv = document.createElement('div');
      itemDiv.className = 'broadcast-history-item';
      itemDiv.innerHTML = `
        <div class="history-item-top">
          <span class="badge ${badgeClass}">${priority} Notice</span>
          <span class="history-time">${timeStr}</span>
        </div>
        <h4 class="history-title">${title}</h4>
        <p class="history-body">${message}</p>
        <span class="history-target">Target: ${target === 'ALL' ? 'All Authorized Distributors' : target + ' District'}</span>
      `;

      broadcastHistoryList.prepend(itemDiv);
      broadcastNotifForm.reset();

      showToast('Official notification broadcasted to FPS Distributors.');
    });
  }

  // =========================================================================
  // SETTINGS FORMS LOGIC
  // =========================================================================
  const adminProfileForm = document.getElementById('adminProfileForm');
  const adminPasswordForm = document.getElementById('adminPasswordForm');

  if (adminProfileForm) {
    adminProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Admin Profile settings saved successfully.');
    });
  }

  if (adminPasswordForm) {
    adminPasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      adminPasswordForm.reset();
      showToast('Administrator security password updated successfully.');
    });
  }

  // =========================================================================
  // INITIAL RENDER CALLS
  // =========================================================================
  renderDistributors();
  updateInventoryDisplay();
  renderDispatches();
  renderAdminNotifications();
});
