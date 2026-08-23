/**
 * Smart Ration Distribution System - FPS Distributor Portal Logic
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // INITIAL STATE & DATA STORES
  // =========================================================================

  // Initial Mock Beneficiaries assigned to FPS-4201
  const defaultBeneficiaries = [
    {
      rationCardNo: 'RC-884210',
      headOfFamily: 'Anand Kumar',
      village: 'Yeshwanthpur',
      familyMembers: 4,
      cardType: 'PHH',
      mobileNumber: '9876543210',
      status: 'Active'
    },
    {
      rationCardNo: 'RC-990124',
      headOfFamily: 'Sunita Sharma',
      village: 'Mathikere',
      familyMembers: 3,
      cardType: 'AAY',
      mobileNumber: '9845012345',
      status: 'Active'
    },
    {
      rationCardNo: 'RC-450129',
      headOfFamily: 'Gopalakrishna Bhat',
      village: 'Hebbal',
      familyMembers: 5,
      cardType: 'PHH',
      mobileNumber: '9900112233',
      status: 'Active'
    },
    {
      rationCardNo: 'RC-332011',
      headOfFamily: 'Fatima Begum',
      village: 'Gokula',
      familyMembers: 6,
      cardType: 'PHH',
      mobileNumber: '9741234567',
      status: 'Active'
    },
    {
      rationCardNo: 'RC-771290',
      headOfFamily: 'Manjunath Gowda',
      village: 'Yeshwanthpur',
      familyMembers: 2,
      cardType: 'NPHH',
      mobileNumber: '9880123987',
      status: 'Active'
    },
    {
      rationCardNo: 'RC-554109',
      headOfFamily: 'Lakshmi Devi',
      village: 'Mathikere',
      familyMembers: 4,
      cardType: 'AAY',
      mobileNumber: '9448123456',
      status: 'Inactive'
    }
  ];

  // Load Beneficiaries with fallback & local registration merge
  let registeredBeneficiaries = loadBeneficiaries();

  // Inventory State (FPS Store Warehouse)
  let fpsInventory = {
    Rice: 120,    // Qtl
    Oil: 150      // Ltr
  };

  // Allocation History Ledger
  let allocationHistory = [
    {
      id: 'ALC-2026-101',
      beneficiaryName: 'Anand Kumar',
      rationCardNo: 'RC-884210',
      breakdown: 'Rice: 20kg, Wheat: 10kg, Sugar: 2kg, Oil: 2L',
      month: 'August 2026',
      status: 'Distributed',
      date: '2026-08-02'
    },
    {
      id: 'ALC-2026-102',
      beneficiaryName: 'Sunita Sharma',
      rationCardNo: 'RC-990124',
      breakdown: 'Rice: 35kg, Sugar: 1kg, Oil: 1L',
      month: 'August 2026',
      status: 'Distributed',
      date: '2026-08-02'
    },
    {
      id: 'ALC-2026-103',
      beneficiaryName: 'Gopalakrishna Bhat',
      rationCardNo: 'RC-450129',
      breakdown: 'Rice: 25kg, Wheat: 15kg, Sugar: 2kg',
      month: 'August 2026',
      status: 'Distributed',
      date: '2026-08-01'
    }
  ];

  // Distribution Transaction Records
  let distributionRecords = [
    {
      id: 'TXN-2026-4201-881',
      beneficiaryName: 'Anand Kumar',
      rationCardNo: 'RC-884210',
      commodities: 'Rice (20kg), Wheat (10kg), Sugar (2kg), Oil (2L)',
      date: '2026-08-02',
      time: '09:15 AM',
      status: 'Completed'
    },
    {
      id: 'TXN-2026-4201-882',
      beneficiaryName: 'Sunita Sharma',
      rationCardNo: 'RC-990124',
      commodities: 'Rice (35kg), Sugar (1kg), Oil (1L)',
      date: '2026-08-02',
      time: '10:30 AM',
      status: 'Completed'
    },
    {
      id: 'TXN-2026-4201-883',
      beneficiaryName: 'Gopalakrishna Bhat',
      rationCardNo: 'RC-450129',
      commodities: 'Rice (25kg), Wheat (15kg)',
      date: '2026-08-01',
      time: '02:45 PM',
      status: 'Completed'
    },
    {
      id: 'TXN-2026-4201-884',
      beneficiaryName: 'Fatima Begum',
      rationCardNo: 'RC-332011',
      commodities: 'Rice (30kg), Wheat (10kg), Oil (2L)',
      date: '2026-08-01',
      time: '04:10 PM',
      status: 'Completed'
    }
  ];

  function loadBeneficiaries() {
    const saved = localStorage.getItem('fps_beneficiaries_cache');
    let list = [...defaultBeneficiaries];

    // Merge registered users from register-user.html if present
    const regUsers = localStorage.getItem('ration_registered_users');
    if (regUsers) {
      try {
        const parsed = JSON.parse(regUsers);
        parsed.forEach(u => {
          if (!list.some(b => b.rationCardNo === u.rationCardNumber)) {
            list.unshift({
              rationCardNo: u.rationCardNumber || 'RC-NEW',
              headOfFamily: u.fullName || 'Cardholder',
              village: u.village || 'Yeshwanthpur',
              familyMembers: parseInt(u.familyMembers, 10) || 4,
              cardType: 'PHH',
              mobileNumber: u.mobileNumber || '9999999999',
              status: 'Active'
            });
          }
        });
      } catch (e) {
        console.error('Error loading registered users:', e);
      }
    }

    if (saved) {
      try {
        const cached = JSON.parse(saved);
        cached.forEach(c => {
          if (!list.some(b => b.rationCardNo === c.rationCardNo)) {
            list.unshift(c);
          }
        });
      } catch (e) {
        console.error('Error parsing cached beneficiaries:', e);
      }
    }

    return list;
  }

  function saveBeneficiaries() {
    localStorage.setItem('fps_beneficiaries_cache', JSON.stringify(registeredBeneficiaries));
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

  // Tab Section Titles Map
  const sectionTitles = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Sri Annapurna Ration Store • FPS-4201' },
    beneficiaries: { title: 'Beneficiary Management', subtitle: 'Assigned Family Records & Ration Cards' },
    allocation: { title: 'Monthly Allocation', subtitle: 'Disburse Subsidized Foodgrain Quotas' },
    inventory: { title: 'FPS Store Inventory', subtitle: 'Real-time Stock Levels & Storage Reserves' },
    distribution: { title: 'Distribution Records', subtitle: 'Real-time Transaction History & Receipts' },
    notifications: { title: 'Notifications', subtitle: 'Official Directives from Civil Supplies Admin' },
    settings: { title: 'Distributor Settings', subtitle: 'FPS Store Profile & Security Configuration' }
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

    // Update page titles
    if (pageTitle) pageTitle.textContent = sectionTitles[targetKey].title;
    if (pageSubtitle) pageSubtitle.textContent = sectionTitles[targetKey].subtitle;

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
    if (confirm('Are you sure you want to log out of the FPS Distributor Portal?')) {
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
  // BENEFICIARY MANAGEMENT LOGIC
  // =========================================================================
  const beneficiariesTableBody = document.getElementById('beneficiariesTableBody');
  const beneficiarySearchInput = document.getElementById('beneficiarySearchInput');
  const villageFilterSelect = document.getElementById('villageFilterSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const beneficiariesCountText = document.getElementById('beneficiariesCountText');
  const dashTotalBeneficiariesCount = document.getElementById('dashTotalBeneficiariesCount');

  // Modal elements
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

  function renderBeneficiaries() {
    const query = beneficiarySearchInput ? beneficiarySearchInput.value.toLowerCase().trim() : '';
    const villageFilter = villageFilterSelect ? villageFilterSelect.value : 'ALL';
    const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'ALL';

    const filtered = registeredBeneficiaries.filter(b => {
      const matchQuery =
        b.rationCardNo.toLowerCase().includes(query) ||
        b.headOfFamily.toLowerCase().includes(query) ||
        b.mobileNumber.toLowerCase().includes(query) ||
        b.village.toLowerCase().includes(query);

      const matchVillage = villageFilter === 'ALL' || b.village === villageFilter;
      const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;

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
        filtered.forEach((ben) => {
          const originalIndex = registeredBeneficiaries.indexOf(ben);
          const tr = document.createElement('tr');

          let cardBadge = 'badge-primary';
          if (ben.cardType === 'AAY') cardBadge = 'badge-warning';
          if (ben.cardType === 'NPHH') cardBadge = 'badge-info';

          let statusBadge = ben.status === 'Active' ? 'badge-success' : 'badge-danger';

          tr.innerHTML = `
            <td><strong>${ben.rationCardNo}</strong></td>
            <td>${ben.headOfFamily}</td>
            <td>${ben.village}</td>
            <td><strong>${ben.familyMembers}</strong> Members</td>
            <td><span class="badge ${cardBadge}">${ben.cardType}</span></td>
            <td>${ben.mobileNumber}</td>
            <td><span class="badge ${statusBadge}">${ben.status}</span></td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon view-ben-btn" data-index="${originalIndex}" title="View Details">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon edit-ben-btn" data-index="${originalIndex}" title="Edit Beneficiary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon delete-ben-btn" data-index="${originalIndex}" title="Delete Beneficiary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          `;

          beneficiariesTableBody.appendChild(tr);
        });
      }
    }

    if (beneficiariesCountText) {
      beneficiariesCountText.textContent = `Showing ${filtered.length} of ${registeredBeneficiaries.length} registered beneficiaries`;
    }

    if (dashTotalBeneficiariesCount) {
      dashTotalBeneficiariesCount.textContent = `${registeredBeneficiaries.length} Families`;
    }

    // Populate Allocation Dropdown
    populateAllocationDropdown();
  }

  // Filter Event Listeners
  if (beneficiarySearchInput) beneficiarySearchInput.addEventListener('input', renderBeneficiaries);
  if (villageFilterSelect) villageFilterSelect.addEventListener('change', renderBeneficiaries);
  if (statusFilterSelect) statusFilterSelect.addEventListener('change', renderBeneficiaries);

  // Modal Controls
  if (openAddBeneficiaryModalBtn) {
    openAddBeneficiaryModalBtn.addEventListener('click', () => {
      beneficiaryForm.reset();
      document.getElementById('editBeneficiaryIndex').value = '-1';
      beneficiaryModalTitle.textContent = 'Add New Beneficiary Family';
      beneficiaryModal.classList.remove('hidden');
    });
  }

  function closeBeneficiaryModal() {
    beneficiaryModal.classList.add('hidden');
  }

  if (closeBeneficiaryModalBtn) closeBeneficiaryModalBtn.addEventListener('click', closeBeneficiaryModal);
  if (cancelBeneficiaryModalBtn) cancelBeneficiaryModalBtn.addEventListener('click', closeBeneficiaryModal);

  // Add/Edit Beneficiary Submission
  if (beneficiaryForm) {
    beneficiaryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const editIdx = parseInt(document.getElementById('editBeneficiaryIndex').value, 10);

      const benObj = {
        rationCardNo: document.getElementById('modalRationCardNo').value.trim().toUpperCase(),
        headOfFamily: document.getElementById('modalHeadOfFamily').value.trim(),
        village: document.getElementById('modalVillage').value.trim(),
        familyMembers: parseInt(document.getElementById('modalFamilyMembers').value, 10) || 1,
        cardType: document.getElementById('modalCardType').value,
        mobileNumber: document.getElementById('modalMobile').value.trim(),
        status: document.getElementById('modalStatus').value
      };

      if (editIdx >= 0) {
        registeredBeneficiaries[editIdx] = benObj;
        showToast(`Updated details for Ration Card ${benObj.rationCardNo}`);
      } else {
        registeredBeneficiaries.unshift(benObj);
        showToast(`Added beneficiary ${benObj.headOfFamily} (${benObj.rationCardNo})`);
        addEventNotification('New Beneficiary Registered', 'New Beneficiary Registration', `New family ${benObj.headOfFamily} (${benObj.rationCardNo}) registered for FPS-4201.`);
      }

      saveBeneficiaries();
      renderBeneficiaries();
      closeBeneficiaryModal();
    });
  }

  // Table Action Event Delegation
  if (beneficiariesTableBody) {
    beneficiariesTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (isNaN(index) || !registeredBeneficiaries[index]) return;

      const ben = registeredBeneficiaries[index];

      if (btn.classList.contains('view-ben-btn')) {
        viewBeneficiaryModalContent.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.9rem;">
            <div><strong>Ration Card No:</strong><br>${ben.rationCardNo}</div>
            <div><strong>Head of Family:</strong><br>${ben.headOfFamily}</div>
            <div><strong>Card Category:</strong><br><span class="badge badge-primary">${ben.cardType}</span></div>
            <div><strong>Family Count:</strong><br>${ben.familyMembers} Members</div>
            <div><strong>Village / Ward:</strong><br>${ben.village}</div>
            <div><strong>Mobile Number:</strong><br>${ben.mobileNumber}</div>
            <div><strong>Status:</strong><br><span class="badge badge-success">${ben.status}</span></div>
            <div><strong>Assigned FPS:</strong><br>FPS-4201 (Sri Annapurna Store)</div>
          </div>
        `;
        viewBeneficiaryModal.classList.remove('hidden');
      }

      if (btn.classList.contains('edit-ben-btn')) {
        document.getElementById('editBeneficiaryIndex').value = index;
        document.getElementById('modalRationCardNo').value = ben.rationCardNo;
        document.getElementById('modalHeadOfFamily').value = ben.headOfFamily;
        document.getElementById('modalVillage').value = ben.village;
        document.getElementById('modalFamilyMembers').value = ben.familyMembers;
        document.getElementById('modalCardType').value = ben.cardType;
        document.getElementById('modalMobile').value = ben.mobileNumber;
        document.getElementById('modalStatus').value = ben.status;

        beneficiaryModalTitle.textContent = 'Edit Beneficiary Details';
        beneficiaryModal.classList.remove('hidden');
      }

      if (btn.classList.contains('delete-ben-btn')) {
        if (confirm(`Are you sure you want to remove Ration Card ${ben.rationCardNo} (${ben.headOfFamily}) from FPS-4201?`)) {
          registeredBeneficiaries.splice(index, 1);
          saveBeneficiaries();
          renderBeneficiaries();
          showToast(`Removed Ration Card ${ben.rationCardNo}`);
        }
      }
    });
  }

  if (closeViewBeneficiaryModalBtn) closeViewBeneficiaryModalBtn.addEventListener('click', () => viewBeneficiaryModal.classList.add('hidden'));
  if (confirmViewBeneficiaryModalBtn) confirmViewBeneficiaryModalBtn.addEventListener('click', () => viewBeneficiaryModal.classList.add('hidden'));

  // =========================================================================
  // MONTHLY ALLOCATION LOGIC
  // =========================================================================
  const allocBeneficiarySelect = document.getElementById('allocBeneficiarySelect');
  const allocationForm = document.getElementById('allocationForm');
  const allocationHistoryTableBody = document.getElementById('allocationHistoryTableBody');

  function populateAllocationDropdown() {
    if (!allocBeneficiarySelect) return;
    allocBeneficiarySelect.innerHTML = '<option value="">-- Choose Ration Card Beneficiary --</option>';

    registeredBeneficiaries.forEach(b => {
      if (b.status === 'Active') {
        const opt = document.createElement('option');
        opt.value = `${b.headOfFamily}|${b.rationCardNo}`;
        opt.textContent = `${b.headOfFamily} (${b.rationCardNo} - ${b.village})`;
        allocBeneficiarySelect.appendChild(opt);
      }
    });
  }

  function renderAllocationHistory() {
    if (!allocationHistoryTableBody) return;
    allocationHistoryTableBody.innerHTML = '';

    allocationHistory.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.id}</strong></td>
        <td>${item.beneficiaryName}</td>
        <td><span class="badge badge-primary">${item.rationCardNo}</span></td>
        <td>${item.breakdown}</td>
        <td>${item.month}</td>
        <td><span class="badge badge-success">${item.status}</span></td>
        <td>${item.date}</td>
      `;
      allocationHistoryTableBody.appendChild(tr);
    });
  }

  if (allocationForm) {
    allocationForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const selVal = allocBeneficiarySelect.value;
      if (!selVal) {
        alert('Please select a beneficiary family.');
        return;
      }

      const [name, cardNo] = selVal.split('|');
      const month = document.getElementById('allocMonthSelect').value;
      const riceQty = parseInt(document.getElementById('allocRiceInput').value, 10) || 0;
      const oilQty = parseInt(document.getElementById('allocOilInput').value, 10) || 0;

      // Decrement inventory stock
      fpsInventory.Rice = Math.max(0, fpsInventory.Rice - Math.round(riceQty / 100)); // convert kg to quintals
      fpsInventory.Oil = Math.max(0, fpsInventory.Oil - oilQty);

      updateInventoryDisplay();

      const breakdownParts = [];
      if (riceQty > 0) breakdownParts.push(`Rice: ${riceQty}kg`);
      if (oilQty > 0) breakdownParts.push(`Oil: ${oilQty}L`);

      const breakdownStr = breakdownParts.join(', ');

      // Create new Allocation History Record
      const newAlloc = {
        id: `ALC-2026-${Math.floor(100 + Math.random() * 900)}`,
        beneficiaryName: name,
        rationCardNo: cardNo,
        breakdown: breakdownStr,
        month: month,
        status: 'Distributed',
        date: new Date().toISOString().split('T')[0]
      };

      allocationHistory.unshift(newAlloc);
      renderAllocationHistory();

      // Create Transaction Record
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const newTxn = {
        id: `TXN-2026-4201-${Math.floor(100 + Math.random() * 900)}`,
        beneficiaryName: name,
        rationCardNo: cardNo,
        commodities: breakdownStr,
        date: now.toISOString().split('T')[0],
        time: timeStr,
        status: 'Completed'
      };

      distributionRecords.unshift(newTxn);
      renderDistributionRecords();

      allocationForm.reset();
      showToast(`Ration successfully disbursed for card ${cardNo} (${name})`);
    });
  }

  // =========================================================================
  // EVENT-BASED NOTIFICATIONS SYSTEM (Pure In-Memory JS)
  // =========================================================================
  let distributorNotifications = [
    {
      id: 'DIST-NOTIF-101',
      title: 'New Stock Dispatched by Admin',
      shortMsg: 'Central warehouse dispatched 120 Qtl Rice & 85 Qtl Wheat for FPS-4201.',
      fullMsg: 'District Civil Supplies Warehouse authorized consignment DSP-2026-901. Transport vehicle KA-01-GA-8842 is en route to Sri Annapurna Ration Store (FPS-4201).',
      date: '03 Aug 2026',
      time: '09:30 AM',
      status: 'Unread',
      category: 'Stock Dispatched',
      issuer: 'District Depot Officer',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-102',
      title: 'Stock Received Successfully',
      shortMsg: 'Received 50 Qtl Rice into store warehouse inventory ledger.',
      fullMsg: 'Inward stock shipment DSP-2026-901 has been verified and credited to FPS-4201 digital inventory balance.',
      date: '02 Aug 2026',
      time: '02:15 PM',
      status: 'Unread',
      category: 'Stock Received',
      issuer: 'Store Warehouse Ledger',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-103',
      title: 'Low Inventory Warning',
      shortMsg: 'Sugar stock at 12 Qtl (below 15 Qtl minimum safety threshold).',
      fullMsg: 'FPS-4201 Sugar inventory has depleted to 12 Quintals. Re-order request auto-generated to District Depot Officer.',
      date: '02 Aug 2026',
      time: '08:00 AM',
      status: 'Unread',
      category: 'Low Inventory',
      issuer: 'FPS Inventory System',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-104',
      title: 'New Beneficiary Registered',
      shortMsg: 'Anand Kumar (RC-884210, PHH Card) assigned to FPS-4201.',
      fullMsg: 'Family head Anand Kumar (RC-884210) with 4 household members has been registered and mapped to Sri Annapurna Ration Store for monthly allocation.',
      date: '01 Aug 2026',
      time: '04:20 PM',
      status: 'Read',
      category: 'New Beneficiary',
      issuer: 'Civil Supplies Portal',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-105',
      title: 'Monthly Allocation Period Started',
      shortMsg: 'August 2026 distribution cycle active. Disburse before Aug 15.',
      fullMsg: 'Official August 2026 ration distribution cycle is now open for all cardholders. Ensure e-POS Aadhaar authentication prior to issuing commodities.',
      date: '01 Aug 2026',
      time: '08:00 AM',
      status: 'Read',
      category: 'Allocation Period',
      issuer: 'Dept of Civil Supplies',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-106',
      title: 'e-POS Machine Terminal Online',
      shortMsg: 'e-POS Terminal #4201-A connected and synced with state server.',
      fullMsg: 'e-POS terminal firmware v3.2 connection test successful. All biometric and OTP authentication protocols functioning properly.',
      date: '31 Jul 2026',
      time: '10:15 AM',
      status: 'Read',
      category: 'Machine Status',
      issuer: 'e-POS Tech Cell',
      expanded: false
    },
    {
      id: 'DIST-NOTIF-107',
      title: 'Distribution Completed Successfully',
      shortMsg: 'Disbursed 18.5 Qtl commodities to 48 families today.',
      fullMsg: 'Daily disbursement reconciliation completed for FPS-4201. Total 48 beneficiary families served via e-POS terminal with zero discrepancies.',
      date: '30 Jul 2026',
      time: '07:30 PM',
      status: 'Read',
      category: 'Distribution Complete',
      issuer: 'FPS e-POS Register',
      expanded: false
    }
  ];

  let activeDistNotifFilter = 'all';

  function renderNotifications() {
    const feedList = document.getElementById('notificationsFeedList');
    const dropdownList = document.getElementById('notifDropdownList');
    const bellCount = document.getElementById('distNotifBellCount');
    const dropdownBadge = document.getElementById('notifDropdownBadge');
    const sidebarBadge = document.querySelector('.nav-item[data-target="notifications"] .nav-badge');

    const unreadCount = distributorNotifications.filter(n => n.status === 'Unread').length;

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

    if (dropdownBadge) {
      dropdownBadge.textContent = unreadCount === 0 ? '0 New' : `${unreadCount} New`;
    }

    if (sidebarBadge) {
      sidebarBadge.textContent = unreadCount;
      sidebarBadge.style.display = unreadCount === 0 ? 'none' : 'inline-block';
    }

    // Filter list
    let filtered = distributorNotifications;
    if (activeDistNotifFilter === 'unread') {
      filtered = distributorNotifications.filter(n => n.status === 'Unread');
    } else if (activeDistNotifFilter === 'read') {
      filtered = distributorNotifications.filter(n => n.status === 'Read');
    }

    // 1. Render Main Notifications Feed List
    if (feedList) {
      feedList.innerHTML = '';
      if (filtered.length === 0) {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            <p style="font-weight: 600;">No notifications found under '${activeDistNotifFilter.toUpperCase()}' filter.</p>
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
            renderNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    // 2. Render Top Dropdown List
    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = distributorNotifications.slice(0, 5);
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
            renderNotifications();
          });

          dropdownList.appendChild(item);
        });
      }
    }
  }

  // Filter Buttons Handler
  const distFilterGroup = document.getElementById('distNotifFilterGroup');
  if (distFilterGroup) {
    const filterBtns = distFilterGroup.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDistNotifFilter = btn.dataset.filter || 'all';
        renderNotifications();
      });
    });
  }

  // Mark All as Read
  const distNotifMarkAllReadBtn = document.getElementById('distNotifMarkAllReadBtn');
  if (distNotifMarkAllReadBtn) {
    distNotifMarkAllReadBtn.addEventListener('click', () => {
      distributorNotifications.forEach(n => n.status = 'Read');
      renderNotifications();
      showToast('All notifications marked as Read.');
    });
  }

  // Clear Read Notifications
  const distNotifClearReadBtn = document.getElementById('distNotifClearReadBtn');
  if (distNotifClearReadBtn) {
    distNotifClearReadBtn.addEventListener('click', () => {
      distributorNotifications = distributorNotifications.filter(n => n.status === 'Unread');
      renderNotifications();
      showToast('Read notifications cleared.');
    });
  }

  // =========================================================================
  // INVENTORY DISPLAY LOGIC
  // =========================================================================
  function updateInventoryDisplay() {
    const invTableBody = document.getElementById('inventoryTableBody');
    if (invTableBody) {
      invTableBody.innerHTML = '';

      const items = [
        { name: 'Rice Stock', qty: fpsInventory.Rice, unit: 'Quintals', min: 20 },
        { name: 'Edible Oil', qty: fpsInventory.Oil, unit: 'Liters', min: 30 }
      ];

      items.forEach(item => {
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
          <td>Today, 08:30 AM</td>
        `;
        invTableBody.appendChild(tr);
      });
    }

    // Dashboard Overview Summary Cards
    const totalStock = fpsInventory.Rice + fpsInventory.Oil;
    const statTotalAvailableStock = document.getElementById('statTotalAvailableStock');
    if (statTotalAvailableStock) {
      statTotalAvailableStock.innerHTML = `${totalStock} <span class="unit">Units</span>`;
    }

    const statStockBreakdownSummary = document.getElementById('statStockBreakdownSummary');
    if (statStockBreakdownSummary) {
      statStockBreakdownSummary.textContent = `Rice: ${fpsInventory.Rice} Qtl | Oil: ${fpsInventory.Oil} Ltr`;
    }

    // Today's collections summary
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxns = distributionRecords.filter(r => r.date === todayStr || r.date === '2026-08-02');
    const statCollectedToday = document.getElementById('statCollectedToday');
    if (statCollectedToday) {
      statCollectedToday.innerHTML = `18.5 <span class="unit">Qtl</span>`;
    }

    const statTodayBeneficiaries = document.getElementById('statTodayBeneficiaries');
    if (statTodayBeneficiaries) {
      statTodayBeneficiaries.textContent = `${todayTxns.length > 0 ? todayTxns.length : 48} Families Disbursed`;
    }

    const statPendingCollections = document.getElementById('statPendingCollections');
    if (statPendingCollections) {
      const totalActive = registeredBeneficiaries.filter(b => b.status === 'Active').length;
      const pending = Math.max(0, totalActive - todayTxns.length);
      statPendingCollections.innerHTML = `${pending > 0 ? pending : 12} <span class="unit">Families</span>`;
    }
  }

  // =========================================================================
  // DISTRIBUTION RECORDS LOGIC
  // =========================================================================
  const distributionTableBody = document.getElementById('distributionTableBody');
  const recentTransactionsTableBody = document.getElementById('recentTransactionsTableBody');
  const distributionSearchInput = document.getElementById('distributionSearchInput');

  function renderDistributionRecords() {
    const query = distributionSearchInput ? distributionSearchInput.value.toLowerCase().trim() : '';

    const filtered = distributionRecords.filter(r => {
      return (
        r.id.toLowerCase().includes(query) ||
        r.beneficiaryName.toLowerCase().includes(query) ||
        r.rationCardNo.toLowerCase().includes(query) ||
        r.commodities.toLowerCase().includes(query)
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
        filtered.forEach(rec => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${rec.id}</strong></td>
            <td>${rec.beneficiaryName}</td>
            <td><span class="badge badge-primary">${rec.rationCardNo}</span></td>
            <td>${rec.commodities}</td>
            <td>${rec.date}</td>
            <td>${rec.time}</td>
            <td><span class="badge badge-success">${rec.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline print-receipt-btn" data-id="${rec.id}">Print Pass</button>
            </td>
          `;
          distributionTableBody.appendChild(tr);
        });
      }
    }

    // Render Recent 4 Transactions on Dashboard
    if (recentTransactionsTableBody) {
      recentTransactionsTableBody.innerHTML = '';
      const recent4 = distributionRecords.slice(0, 4);

      recent4.forEach(rec => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${rec.id}</strong></td>
          <td>${rec.beneficiaryName}</td>
          <td><span class="badge badge-primary">${rec.rationCardNo}</span></td>
          <td>${rec.commodities}</td>
          <td>${rec.time}</td>
          <td><span class="badge badge-success">${rec.status}</span></td>
        `;
        recentTransactionsTableBody.appendChild(tr);
      });
    }
  }

  if (distributionSearchInput) {
    distributionSearchInput.addEventListener('input', renderDistributionRecords);
  }

  // Print Pass Event Delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('print-receipt-btn')) {
      const id = e.target.getAttribute('data-id');
      const rec = distributionRecords.find(r => r.id === id);
      if (rec) {
        alert(`FOOD & CIVIL SUPPLIES DEPARTMENT\nFair Price Shop Official Collection Pass\n\nTransaction ID: ${rec.id}\nStore Code: FPS-4201 (Sri Annapurna Store)\nCardholder: ${rec.beneficiaryName} (${rec.rationCardNo})\nDisbursed Items: ${rec.commodities}\nDate & Time: ${rec.date} ${rec.time}\nStatus: ${rec.status}`);
      }
    }
  });

  // =========================================================================
  // SETTINGS FORMS LOGIC
  // =========================================================================
  const distributorProfileForm = document.getElementById('distributorProfileForm');
  const distributorPasswordForm = document.getElementById('distributorPasswordForm');

  if (distributorProfileForm) {
    distributorProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('FPS Store & Licensee Profile saved successfully.');
    });
  }

  if (distributorPasswordForm) {
    distributorPasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      distributorPasswordForm.reset();
      showToast('Distributor security password updated successfully.');
    });
  }

  // =========================================================================
  // INITIAL RENDER CALLS
  // =========================================================================
  renderBeneficiaries();
  renderAllocationHistory();
  updateInventoryDisplay();
  renderNotifications();
  renderDistributionRecords();
});
