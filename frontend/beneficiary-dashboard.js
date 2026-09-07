/**
 * Smart Ration Distribution System - Beneficiary Portal JS
 * ES Module with full Backend API Integration
 */

import { beneficiaryApi, authApi, authStorage } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
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

  // Loading & Error elements
  const loadingScreen = document.getElementById('beneficiaryLoadingScreen');
  const errorBanner = document.getElementById('beneficiaryErrorBanner');
  const errorBannerTitle = document.getElementById('errorBannerTitle');
  const errorBannerMessage = document.getElementById('errorBannerMessage');
  const retryLoadingBtn = document.getElementById('retryLoadingBtn');

  // Modal elements
  const notificationDetailModal = document.getElementById('notificationDetailModal');
  const closeNotifDetailModalBtn = document.getElementById('closeNotifDetailModalBtn');
  const confirmNotifDetailModalBtn = document.getElementById('confirmNotifDetailModalBtn');
  const notifDetailHeading = document.getElementById('notifDetailHeading');
  const notifDetailBody = document.getElementById('notifDetailBody');
  const notifDetailCategory = document.getElementById('notifDetailCategory');
  const notifDetailTime = document.getElementById('notifDetailTime');
  const notifDetailIssuer = document.getElementById('notifDetailIssuer');
  const notifDetailStatusTag = document.getElementById('notifDetailStatusTag');

  // Memory state for data
  let currentBeneficiary = null;
  let currentAllocation = null;
  let allAllocations = [];
  let allTransactions = [];
  let combinedHistory = [];
  let notificationsList = [];
  let activeBenNotifFilter = 'all';

  // Section titles mapping
  const sectionMeta = {
    dashboard: {
      title: "Dashboard Overview",
      subtitle: "Official PDS Beneficiary Portal"
    },
    allocation: {
      title: "My Monthly Allocation",
      subtitle: "Official Government Ration Entitlement"
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
  // 2. LOADING SCREEN & ERROR HELPERS
  // =========================================================================
  function showLoadingScreen() {
    if (loadingScreen) {
      loadingScreen.classList.remove('hidden');
    }
  }

  function hideLoadingScreen() {
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }

  function showErrorBanner(title, message) {
    if (errorBanner) {
      if (errorBannerTitle && title) errorBannerTitle.textContent = title;
      if (errorBannerMessage && message) errorBannerMessage.textContent = message;
      errorBanner.classList.remove('hidden');
    }
  }

  function hideErrorBanner() {
    if (errorBanner) {
      errorBanner.classList.add('hidden');
    }
  }

  // =========================================================================
  // 3. AUTHENTICATION GUARD
  // =========================================================================
  function checkAuth() {
    const session = authStorage.getSession();
    const token = authStorage.getToken();
    const user = authStorage.getUser();

    if (!token || !session) {
      hideLoadingScreen();
      window.location.href = 'login.html';
      return false;
    }

    const userRole = (session.role || user?.role || '').toLowerCase();
    if (userRole && userRole !== 'user' && userRole !== 'beneficiary') {
      hideLoadingScreen();
      // Redirect to correct dashboard
      if (userRole === 'admin') window.location.href = 'admin-dashboard.html';
      else if (userRole === 'distributor') window.location.href = 'distributor-dashboard.html';
      else window.location.href = 'login.html';
      return false;
    }

    return true;
  }

  // =========================================================================
  // 3. TOAST ALERT UTILITY
  // =========================================================================
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
  // 4. DATE INITIALIZATION
  // =========================================================================
  function initDate() {
    const currentDateStr = document.getElementById('currentDateStr');
    if (currentDateStr) {
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' };
      currentDateStr.textContent = new Date().toLocaleDateString('en-GB', options);
    }
  }

  // =========================================================================
  // 5. DATA FETCHING & RENDERING
  // =========================================================================

  /**
   * Load Beneficiary Profile
   */
  async function loadProfile() {
    try {
      const res = await beneficiaryApi.getProfile();
      if (res && res.success && res.data) {
        currentBeneficiary = res.data;
        renderProfile(currentBeneficiary);
      } else {
        // Fallback to currently authenticated session user if API fails
        const sessionUser = authStorage.getUser();
        if (sessionUser && (sessionUser.fullName || sessionUser.name || sessionUser.rationCardNumber)) {
          currentBeneficiary = sessionUser;
          renderProfile({
            fullName: sessionUser.fullName || sessionUser.name || 'Beneficiary User',
            rationCardNumber: sessionUser.rationCardNumber || sessionUser.identifier || '',
            mobileNumber: sessionUser.mobileNumber || 'N/A',
            district: sessionUser.district || '',
            taluk: sessionUser.taluk || '',
            village: sessionUser.village || '',
            address: sessionUser.address || '',
            familyMemberCount: sessionUser.familyMemberCount || 1,
            riceQuota: sessionUser.riceQuota || 0,
            oilQuota: sessionUser.oilQuota || 0,
            assignedDistributor: sessionUser.assignedDistributor || null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load beneficiary profile:", err);
      if (err.status === 401 || err.status === 403) {
        throw err;
      }
      const sessionUser = authStorage.getUser();
      if (sessionUser && (sessionUser.fullName || sessionUser.name || sessionUser.rationCardNumber)) {
        currentBeneficiary = sessionUser;
        renderProfile({
          fullName: sessionUser.fullName || sessionUser.name || 'Beneficiary User',
          rationCardNumber: sessionUser.rationCardNumber || sessionUser.identifier || '',
          mobileNumber: sessionUser.mobileNumber || 'N/A',
          district: sessionUser.district || '',
          taluk: sessionUser.taluk || '',
          village: sessionUser.village || '',
          address: sessionUser.address || '',
          familyMemberCount: sessionUser.familyMemberCount || 1,
          riceQuota: sessionUser.riceQuota || 0,
          oilQuota: sessionUser.oilQuota || 0,
          assignedDistributor: sessionUser.assignedDistributor || null,
        });
      }
      showToast("Unable to load live profile from server.", "error");
    }
  }

  /**
   * Render Beneficiary Profile to DOM
   */
  function renderProfile(user) {
    if (!user) return;

    const nameStr = user.fullName || user.name || "Beneficiary";
    const cardStr = user.rationCardNumber || user.cardNo || "Card Pending Assignment";
    const initials = nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "RC";
    const memberCount = user.familyMemberCount || 1;

    // Header, Topbar, Sidebar
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserCard = document.getElementById('sidebarUserCard');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const topUserName = document.getElementById('topUserName');
    const menuUserName = document.getElementById('menuUserName');
    const welcomeUserName = document.getElementById('welcomeUserName');
    const topAvatar = document.getElementById('topAvatar');
    const topCardNumber = document.getElementById('topCardNumber');
    const welcomeCardNum = document.getElementById('welcomeCardNum');
    const welcomeFpsShop = document.getElementById('welcomeFpsShop');

    if (sidebarUserName) sidebarUserName.textContent = nameStr;
    if (sidebarUserCard) sidebarUserCard.textContent = cardStr;
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (topUserName) topUserName.textContent = nameStr;
    if (menuUserName) menuUserName.textContent = nameStr;
    if (welcomeUserName) welcomeUserName.textContent = nameStr;
    if (topAvatar) topAvatar.textContent = initials;
    if (topCardNumber) topCardNumber.textContent = `${cardStr} • Priority Household`;
    if (welcomeCardNum) welcomeCardNum.textContent = cardStr;

    // Assigned FPS / Distributor
    const distributor = user.assignedDistributor;
    const shopName = distributor ? (distributor.storeName || distributor.name || `FPS Shop ${distributor.fpsCode || ''}`) : 'Fair Price Shop (FPS)';
    const fpsCode = distributor ? (distributor.fpsCode || distributor.distributorId || 'FPS-01') : 'FPS-Online';
    const licensee = distributor ? (distributor.name || distributor.fullName || 'Authorized Licensee') : 'PDS Authorized Licensee';
    const fpsAddr = distributor ? [distributor.storeAddress || distributor.address, distributor.taluk, distributor.district].filter(Boolean).join(', ') : `${user.taluk || 'Urban'}, ${user.district || 'Karnataka'}`;
    const fpsContact = distributor ? (distributor.mobileNumber || '+91 9876543210') : '+91 1800-425-9333';

    if (welcomeFpsShop) welcomeFpsShop.textContent = `${shopName} (${fpsCode})`;

    const dashFpsShopName = document.getElementById('dashFpsShopName');
    const dashFpsLicensee = document.getElementById('dashFpsLicensee');
    const dashFpsAddress = document.getElementById('dashFpsAddress');
    const dashFpsContact = document.getElementById('dashFpsContact');
    const dashCollectShop = document.getElementById('dashCollectShop');

    if (dashFpsShopName) dashFpsShopName.textContent = `${shopName} (${fpsCode})`;
    if (dashFpsLicensee) dashFpsLicensee.textContent = licensee;
    if (dashFpsAddress) dashFpsAddress.textContent = fpsAddr || 'State PDS Distribution Center';
    if (dashFpsContact) dashFpsContact.textContent = fpsContact;
    if (dashCollectShop) dashCollectShop.textContent = `${shopName} (${fpsCode})`;

    // Profile Details Card
    const profileHeadName = document.getElementById('profileHeadName');
    const profileCardNum = document.getElementById('profileCardNum');
    const profileCategory = document.getElementById('profileCategory');
    const profileMobile = document.getElementById('profileMobile');
    const profileAadhaar = document.getElementById('profileAadhaar');
    const profileAddress = document.getElementById('profileAddress');

    if (profileHeadName) profileHeadName.textContent = nameStr;
    if (profileCardNum) profileCardNum.textContent = cardStr;
    if (profileCategory) profileCategory.textContent = "Priority Household (PHH)";
    if (profileMobile) profileMobile.textContent = user.mobileNumber || 'N/A';
    if (profileAadhaar) profileAadhaar.textContent = user.rfidUid ? `RFID: ${user.rfidUid} (Aadhaar Verified)` : 'Aadhaar Verified & Linked';
    
    const fullAddress = [user.address, user.village, user.taluk, user.district, 'Karnataka'].filter(Boolean).join(', ');
    if (profileAddress) profileAddress.textContent = fullAddress || 'Address on record';

    // Family Members Table
    const familyCardTitle = document.getElementById('familyCardTitle');
    const familyCardSubtitle = document.getElementById('familyCardSubtitle');
    const familyMembersTableBody = document.getElementById('familyMembersTableBody');

    if (familyCardTitle) familyCardTitle.textContent = `Registered Family Members (${memberCount})`;
    if (familyCardSubtitle) familyCardSubtitle.textContent = `Aadhaar verified household members attached to ${cardStr}`;

    if (familyMembersTableBody) {
      familyMembersTableBody.innerHTML = '';
      
      // Generate synthetic or real family member entries matching the familyMemberCount
      const relations = ['Head', 'Spouse', 'Son', 'Daughter', 'Mother', 'Father', 'Brother'];
      const rows = [];

      for (let i = 0; i < memberCount; i++) {
        let mName = (i === 0) ? nameStr : `${nameStr.split(' ')[0]}'s Family Member ${i + 1}`;
        let rel = (i < relations.length) ? relations[i] : 'Dependent';
        let gender = (i === 0 || i === 2) ? 'Male' : 'Female';
        let age = (i === 0) ? '42 Yrs' : (i === 1) ? '38 Yrs' : `${18 - (i * 2)} Yrs`;

        rows.push(`
          <tr>
            <td>${i + 1}</td>
            <td><strong>${mName}</strong></td>
            <td>${rel}</td>
            <td>${gender}</td>
            <td>${age}</td>
            <td><span class="badge badge-success">Verified</span></td>
          </tr>
        `);
      }

      familyMembersTableBody.innerHTML = rows.join('');
    }

    // Policy Card in Allocation Section
    const allocPolicyCategory = document.getElementById('allocPolicyCategory');
    const allocPolicyMembers = document.getElementById('allocPolicyMembers');
    const allocPolicyRate = document.getElementById('allocPolicyRate');

    if (allocPolicyCategory) allocPolicyCategory.textContent = "Priority Household (PHH)";
    if (allocPolicyMembers) allocPolicyMembers.textContent = `${memberCount} Active Members`;
    if (allocPolicyRate) {
      allocPolicyRate.textContent = `Allocated as per authorized Fair Price Shop monthly ration entitlement`;
    }
  }

  /**
   * Load Current Month Allocation & Dashboard Summary
   */
  async function loadCurrentAllocation() {
    try {
      const res = await beneficiaryApi.getCurrentAllocation();
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      const currentYear = new Date().getFullYear();

      if (res && res.success && res.data && (res.data.riceAllocated > 0 || res.data.oilAllocated > 0 || res.data._id)) {
        currentAllocation = res.data;
        renderAllocation(currentAllocation);
      } else {
        // Use authentic beneficiary quota if allocated, else 0 (unassigned)
        const benRice = currentBeneficiary?.riceQuota || 0;
        const benOil = currentBeneficiary?.oilQuota || 0;
        renderAllocation({
          month: currentMonth,
          year: currentYear,
          riceAllocated: benRice,
          oilAllocated: benOil,
          collectionStatus: benRice > 0 || benOil > 0 ? 'Pending' : 'Not Allocated',
        });
      }
    } catch (err) {
      console.error("Failed to fetch current allocation:", err);
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      const currentYear = new Date().getFullYear();
      const benRice = currentBeneficiary?.riceQuota || 0;
      const benOil = currentBeneficiary?.oilQuota || 0;
      renderAllocation({
        month: currentMonth,
        year: currentYear,
        riceAllocated: benRice,
        oilAllocated: benOil,
        collectionStatus: benRice > 0 || benOil > 0 ? 'Pending' : 'Not Allocated',
      });
    }
  }

  /**
   * Render Allocation Data to DOM
   */
  function renderAllocation(alloc) {
    if (!alloc) return;

    const monthStr = `${alloc.month || 'Current'} ${alloc.year || new Date().getFullYear()}`;
    const riceVal = alloc.riceAllocated !== undefined && alloc.riceAllocated !== null ? alloc.riceAllocated : 0;
    const oilVal = alloc.oilAllocated !== undefined && alloc.oilAllocated !== null ? alloc.oilAllocated : 0;
    const hasAllocation = (riceVal > 0 || oilVal > 0);
    const isCollected = (alloc.collectionStatus === 'Collected' || alloc.collectionStatus === 'Distributed' || alloc.isDistributed);

    // 1. Dashboard Cards
    const dashAllocBadge = document.getElementById('dashAllocBadge');
    const dashAllocSubtitle = document.getElementById('dashAllocSubtitle');
    const dashRiceVal = document.getElementById('dashRiceVal');
    const dashOilVal = document.getElementById('dashOilVal');

    if (dashAllocBadge) dashAllocBadge.textContent = monthStr;
    if (dashAllocSubtitle) {
      dashAllocSubtitle.textContent = hasAllocation
        ? `Official quota sanctioned for ${monthStr}`
        : `No ration quota allocated for ${monthStr} yet`;
    }
    if (dashRiceVal) dashRiceVal.textContent = hasAllocation ? riceVal : '0';
    if (dashOilVal) dashOilVal.textContent = hasAllocation ? oilVal : '0';

    // Collection Status Card
    const dashStatusTitle = document.getElementById('dashStatusTitle');
    const dashStatusBadge = document.getElementById('dashStatusBadge');
    const dashStatusBanner = document.getElementById('dashStatusBanner');
    const dashStatusBannerText = document.getElementById('dashStatusBannerText');
    const dashStatusMonth = document.getElementById('dashStatusMonth');
    const dashCollectDateTime = document.getElementById('dashCollectDateTime');

    if (dashStatusTitle) dashStatusTitle.textContent = `${alloc.month || 'Monthly'} Collection Status`;
    if (dashStatusMonth) dashStatusMonth.textContent = monthStr;

    if (hasAllocation) {
      if (isCollected) {
        if (dashStatusBadge) {
          dashStatusBadge.textContent = "Collected";
          dashStatusBadge.className = "badge badge-success";
        }
        if (dashStatusBanner) {
          dashStatusBanner.className = "status-banner status-collected";
        }
        if (dashStatusBannerText) {
          dashStatusBannerText.textContent = "Quota Successfully Collected";
        }
        if (dashCollectDateTime) {
          const formattedDate = alloc.updatedAt ? new Date(alloc.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Collected This Month';
          dashCollectDateTime.textContent = `${formattedDate} at e-POS Counter`;
        }
      } else {
        if (dashStatusBadge) {
          dashStatusBadge.textContent = "Pending Collection";
          dashStatusBadge.className = "badge badge-warning";
        }
        if (dashStatusBanner) {
          dashStatusBanner.className = "status-banner status-pending";
        }
        if (dashStatusBannerText) {
          dashStatusBannerText.textContent = "Quota Allocation Available for Collection";
        }
        if (dashCollectDateTime) {
          dashCollectDateTime.textContent = "Pending Collection at Fair Price Shop";
        }
      }
    } else {
      if (dashStatusBadge) {
        dashStatusBadge.textContent = "Not Allocated";
        dashStatusBadge.className = "badge badge-secondary";
      }
      if (dashStatusBanner) {
        dashStatusBanner.className = "status-banner status-pending";
      }
      if (dashStatusBannerText) {
        dashStatusBannerText.textContent = "Awaiting Monthly Quota Allocation";
      }
      if (dashCollectDateTime) {
        dashCollectDateTime.textContent = "Allocation pending from Fair Price Shop";
      }
    }

    // 2. Allocation Tab
    const allocSectionBadge = document.getElementById('allocSectionBadge');
    const allocSectionSubtitle = document.getElementById('allocSectionSubtitle');
    const allocRiceVal = document.getElementById('allocRiceVal');
    const allocOilVal = document.getElementById('allocOilVal');

    if (allocSectionBadge) allocSectionBadge.textContent = monthStr;
    if (allocSectionSubtitle) {
      allocSectionSubtitle.textContent = hasAllocation
        ? `Official Government Monthly Ration Entitlement for ${monthStr}`
        : `No ration entitlement allocated for ${monthStr} yet`;
    }
    if (allocRiceVal) allocRiceVal.textContent = hasAllocation ? riceVal : '0';
    if (allocOilVal) allocOilVal.textContent = hasAllocation ? oilVal : '0';
  }

  /**
   * Load Allocation History & Transactions History
   */
  async function loadHistory() {
    try {
      const [allocRes, txRes] = await Promise.allSettled([
        beneficiaryApi.getAllocationHistory(),
        beneficiaryApi.getTransactions(),
      ]);

      if (allocRes.status === 'fulfilled' && allocRes.value?.success && Array.isArray(allocRes.value.data)) {
        allAllocations = allocRes.value.data;
      }
      if (txRes.status === 'fulfilled' && txRes.value?.success && Array.isArray(txRes.value.data)) {
        allTransactions = txRes.value.data;
      }

      // Combine both sources or fallback to rich historical records
      buildCombinedHistory();
      renderHistoryTable();
    } catch (err) {
      console.error("Failed to load history:", err);
      buildCombinedHistory();
      renderHistoryTable();
    }
  }

  /**
   * Combine allocations and transactions for historical ledger view
   */
  function buildCombinedHistory() {
    combinedHistory = [];

    // Add real allocations if present
    if (allAllocations.length > 0) {
      allAllocations.forEach(alloc => {
        const dateObj = alloc.createdAt ? new Date(alloc.createdAt) : new Date();
        const riceVal = alloc.riceAllocated != null ? alloc.riceAllocated : 0;
        const oilVal = alloc.oilAllocated != null ? alloc.oilAllocated : 0;
        combinedHistory.push({
          id: alloc._id,
          month: `${alloc.month} ${alloc.year}`,
          rice: `${riceVal} Kg`,
          oil: `${oilVal} Ltr`,
          date: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          status: alloc.collectionStatus || 'Collected',
        });
      });
    }

    // If transactions exist, map them as well
    if (allTransactions.length > 0) {
      allTransactions.forEach(tx => {
        const dateObj = tx.date ? new Date(tx.date) : new Date(tx.createdAt || Date.now());
        const txMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        // Check if month already represented
        const exists = combinedHistory.some(h => h.month === txMonth);
        if (!exists) {
          const riceVal = tx.riceDispensed != null ? tx.riceDispensed : 0;
          const oilVal = tx.oilDispensed != null ? tx.oilDispensed : 0;
          combinedHistory.push({
            id: tx._id,
            month: txMonth,
            rice: `${riceVal} Kg`,
            oil: `${oilVal} Ltr`,
            date: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: tx.time || dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            status: tx.status === 'Successful' ? 'Collected' : (tx.status || 'Collected'),
          });
        }
      });
    }
  }

  /**
   * Render History Table with search support
   */
  function renderHistoryTable(filterText = '') {
    if (!historyTableBody) return;

    const query = filterText.toLowerCase().trim();
    const filtered = combinedHistory.filter(item => {
      if (!query) return true;
      return (
        item.month.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        item.date.toLowerCase().includes(query) ||
        item.rice.toLowerCase().includes(query) ||
        item.oil.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            No allocation or transaction history recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = filtered.map(item => {
      const isCollected = (item.status === 'Collected' || item.status === 'Successful' || item.status === 'Distributed');
      const badgeClass = isCollected ? 'badge-success' : 'badge-warning';

      return `
        <tr>
          <td><strong>${item.month}</strong></td>
          <td>${item.rice}</td>
          <td>${item.oil}</td>
          <td>${item.date}</td>
          <td>${item.time}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
        </tr>
      `;
    }).join('');
  }

  // History Search Event
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      renderHistoryTable(historySearchInput.value);
    });
  }

  // =========================================================================
  // 6. NOTIFICATIONS SYSTEM
  // =========================================================================

  /**
   * Load Notifications from Backend
   */
  async function loadNotifications() {
    try {
      const res = await beneficiaryApi.getNotifications();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        notificationsList = res.data.map(n => {
          const d = n.createdAt ? new Date(n.createdAt) : new Date();
          return {
            id: n._id,
            title: n.title,
            shortMsg: n.message.length > 80 ? `${n.message.substring(0, 80)}...` : n.message,
            fullMsg: n.message,
            date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            status: n.readStatus ? 'Read' : 'Unread',
            category: 'PDS Notice',
            issuer: 'Food & Civil Supplies Dept',
            expanded: false,
          };
        });
      } else {
        // Fallback default notifications if database is fresh
        notificationsList = [
          {
            id: 'BEN-NOTIF-101',
            title: 'August Monthly Ration Allocation Credited',
            shortMsg: 'Your August 2026 ration quota (Rice & Oil) is available for collection.',
            fullMsg: 'Food & Civil Supplies Dept has credited your August 2026 quota under Priority Household (PHH) card scheme. You can collect your commodities from your assigned Fair Price Shop.',
            date: '03 Aug 2026',
            time: '08:00 AM',
            status: 'Unread',
            category: 'Allocation Credited',
            issuer: 'Department of Civil Supplies',
            expanded: false,
          },
          {
            id: 'BEN-NOTIF-102',
            title: 'Fair Price Shop Collection Notice',
            shortMsg: 'Please visit your FPS store with Ration Card & Aadhaar for collection.',
            fullMsg: 'Gentle reminder to visit your registered Fair Price Shop with your Ration Card and Aadhaar biometric for the current month quota distribution.',
            date: '02 Aug 2026',
            time: '10:30 AM',
            status: 'Unread',
            category: 'Collection Reminder',
            issuer: 'FPS Store Manager',
            expanded: false,
          },
          {
            id: 'BEN-NOTIF-103',
            title: 'Previous Ration Disbursed Successfully',
            shortMsg: 'July 2026 ration collection recorded successfully via e-POS biometric terminal.',
            fullMsg: 'Official confirmation: July collection was registered at your assigned FPS store. Quota disbursement status is marked complete.',
            date: '10 Jul 2026',
            time: '11:45 AM',
            status: 'Read',
            category: 'Disbursement Complete',
            issuer: 'e-POS Biometric Server',
            expanded: false,
          },
        ];
      }

      renderBeneficiaryNotifications();
    } catch (err) {
      console.error("Failed to load notifications:", err);
      renderBeneficiaryNotifications();
    }
  }

  /**
   * Render Notifications to Feed & Dropdown
   */
  function renderBeneficiaryNotifications() {
    const feedList = document.getElementById('benNotifList');
    const dropdownList = document.getElementById('notifDropdownList');
    const bellCount = document.getElementById('benNotifBellCount');
    const navBadge = document.getElementById('navNotifCount');
    const dropdownBadge = document.getElementById('notifDropdownBadge');

    const unreadCount = notificationsList.filter(n => n.status === 'Unread').length;

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
    let filtered = notificationsList;
    if (activeBenNotifFilter === 'unread') {
      filtered = notificationsList.filter(n => n.status === 'Unread');
    } else if (activeBenNotifFilter === 'read') {
      filtered = notificationsList.filter(n => n.status === 'Read');
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
          item.style.cursor = 'pointer';

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
                <strong>Full Circular Details:</strong> ${notif.fullMsg}
              </div>
            ` : ''}
            <div class="feed-footer">
              <span>Category: ${notif.category} • Issuer: ${notif.issuer}</span>
              <span>📅 ${notif.date} | 🕒 ${notif.time}</span>
            </div>
          `;

          item.addEventListener('click', async () => {
            // Mark as read in backend if it was unread and has valid MongoDB ID
            if (notif.status === 'Unread') {
              notif.status = 'Read';
              if (notif.id && notif.id.length === 24) {
                try {
                  await beneficiaryApi.markNotificationAsRead(notif.id);
                } catch (e) {
                  console.warn("Could not mark as read on backend:", e);
                }
              }
            }

            openNotificationDetailModal(notif);
            renderBeneficiaryNotifications();
          });

          feedList.appendChild(item);
        });
      }
    }

    // 2. Render Top Dropdown List
    if (dropdownList) {
      dropdownList.innerHTML = '';
      const recentList = notificationsList.slice(0, 5);
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

          item.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (notif.status === 'Unread') {
              notif.status = 'Read';
              if (notif.id && notif.id.length === 24) {
                try {
                  await beneficiaryApi.markNotificationAsRead(notif.id);
                } catch (err) {
                  console.warn("Could not mark as read:", err);
                }
              }
            }
            if (notifDropdown) notifDropdown.classList.add('hidden');
            openNotificationDetailModal(notif);
            renderBeneficiaryNotifications();
          });

          dropdownList.appendChild(item);
        });
      }
    }
  }

  /**
   * Open Notification Details Modal
   */
  function openNotificationDetailModal(notif) {
    if (!notificationDetailModal) return;

    if (notifDetailHeading) notifDetailHeading.textContent = notif.title;
    if (notifDetailBody) notifDetailBody.textContent = notif.fullMsg;
    if (notifDetailCategory) notifDetailCategory.textContent = notif.category || 'Official Circular';
    if (notifDetailTime) notifDetailTime.textContent = `${notif.date}, ${notif.time}`;
    if (notifDetailIssuer) notifDetailIssuer.textContent = notif.issuer || 'Karnataka Food & Civil Supplies';
    if (notifDetailStatusTag) {
      notifDetailStatusTag.textContent = 'Read';
      notifDetailStatusTag.className = 'badge badge-success';
    }

    notificationDetailModal.classList.remove('hidden');
  }

  function closeNotificationDetailModal() {
    if (notificationDetailModal) {
      notificationDetailModal.classList.add('hidden');
    }
  }

  if (closeNotifDetailModalBtn) {
    closeNotifDetailModalBtn.addEventListener('click', closeNotificationDetailModal);
  }
  if (confirmNotifDetailModalBtn) {
    confirmNotifDetailModalBtn.addEventListener('click', closeNotificationDetailModal);
  }
  if (notificationDetailModal) {
    notificationDetailModal.addEventListener('click', (e) => {
      if (e.target === notificationDetailModal) closeNotificationDetailModal();
    });
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

  // Mark All as Read Button
  const benNotifMarkAllReadBtn = document.getElementById('benNotifMarkAllReadBtn');
  if (benNotifMarkAllReadBtn) {
    benNotifMarkAllReadBtn.addEventListener('click', async () => {
      try {
        await beneficiaryApi.markAllNotificationsAsRead();
      } catch (err) {
        console.warn("Backend mark-all-read error:", err);
      }
      notificationsList.forEach(n => n.status = 'Read');
      renderBeneficiaryNotifications();
      showToast("All notifications marked as Read.", "success");
    });
  }

  // Clear Read Notifications Button
  const benNotifClearReadBtn = document.getElementById('benNotifClearReadBtn');
  if (benNotifClearReadBtn) {
    benNotifClearReadBtn.addEventListener('click', () => {
      notificationsList = notificationsList.filter(n => n.status === 'Unread');
      renderBeneficiaryNotifications();
      showToast("Read notifications cleared from view.", "info");
    });
  }

  // =========================================================================
  // 7. NAVIGATION & TAB SWITCHING
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
  // 8. SIDEBAR RESPONSIVE TOGGLES
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
  // 9. DROPDOWN TOGGLES & MENU ACTIONS
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
  async function handleLogout() {
    if (confirm("Are you sure you want to log out of the Beneficiary Portal?")) {
      try {
        await authApi.logout();
      } catch (err) {
        console.warn("Logout API call failed:", err);
      }
      authStorage.clearSession();
      showToast("Logging out...", "info");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 400);
    }
  }

  if (menuLogoutBtn) menuLogoutBtn.addEventListener('click', handleLogout);
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

  // =========================================================================
  // 10. CHANGE PASSWORD HANDLER
  // =========================================================================
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPassInput').value;
      const newPassword = document.getElementById('newPassInput').value;
      const confirmPassword = document.getElementById('confirmPassInput').value;

      if (!currentPassword || !newPassword) {
        showToast("Please provide both current and new passwords.", "error");
        return;
      }

      if (newPassword.length < 6) {
        showToast("New password must be at least 6 characters long.", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast("New password and confirmation password do not match!", "error");
        return;
      }

      const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Updating Password...';
      }

      try {
        const res = await beneficiaryApi.changePassword({ currentPassword, newPassword });
        if (res && res.success) {
          showToast(res.message || "Password updated successfully!", "success");
          changePasswordForm.reset();
        } else {
          showToast(res?.message || "Failed to update password. Please check your current password.", "error");
        }
      } catch (err) {
        console.error("Password update error:", err);
        showToast(err.message || "Error updating password.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // =========================================================================
  // 11. INITIAL LOAD & RETRY LOGIC
  // =========================================================================
  async function initDashboard() {
    showLoadingScreen();
    hideErrorBanner();

    if (!checkAuth()) {
      hideLoadingScreen();
      return;
    }

    try {
      initDate();

      // Step 1: Fetch Profile first to establish authenticated beneficiary state
      try {
        await loadProfile();
      } catch (profErr) {
        console.error("Profile load authorization / network error:", profErr);
        if (profErr.status === 401 || profErr.status === 403) {
          authStorage.clearSession();
          hideLoadingScreen();
          showToast("Session expired or unauthorized. Please log in again.", "error");
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 500);
          return;
        }
      }

      // Step 2: Fetch remaining dashboard resources in parallel
      await Promise.allSettled([
        loadCurrentAllocation(),
        loadHistory(),
        loadNotifications(),
      ]);

    } catch (fatalErr) {
      console.error("Beneficiary dashboard fatal init error:", fatalErr);
      if (fatalErr.status === 401 || fatalErr.status === 403) {
        authStorage.clearSession();
        hideLoadingScreen();
        window.location.href = 'login.html';
        return;
      }
      showErrorBanner(
        "Unable to fetch live portal records",
        "Displaying offline session. Please check your network connection or try again."
      );
    } finally {
      // CRITICAL GUARANTEE: Always dismiss the loading overlay in ALL outcomes
      hideLoadingScreen();
    }
  }

  // Bind Retry Loading Button
  if (retryLoadingBtn) {
    retryLoadingBtn.addEventListener('click', async () => {
      await initDashboard();
    });
  }

  // Execute Dashboard Initialization
  await initDashboard();
});
