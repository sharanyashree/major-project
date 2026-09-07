/**
 * Ration Distribution System - Login Page Logic
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Connected to Express + MongoDB Backend API Endpoints
 */

import { authApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // STATE & CONFIGURATION
  // =========================================================================
  let selectedRole = 'user'; // Default selected role

  const roleConfigs = {
    user: {
      label: 'Ration Card / Mobile Number',
      placeholder: 'Enter Ration Card or Mobile Number',
      iconSvg: `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>`,
      minLength: 4,
      errorEmpty: 'Please enter your Ration Card Number or Mobile Number.',
      errorInvalid: 'Must be at least 4 characters long.'
    },
    distributor: {
      label: 'Distributor ID',
      placeholder: 'Enter Distributor ID (e.g. DIST-8842)',
      iconSvg: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
      minLength: 4,
      errorEmpty: 'Please enter your Distributor ID.',
      errorInvalid: 'Distributor ID must be at least 4 characters long.'
    },
    admin: {
      label: 'Admin ID',
      placeholder: 'Enter Admin ID (e.g. ADM-101)',
      iconSvg: `<line x1="2" y1="20" x2="22" y2="20"/><line x1="6" y1="11" x2="6" y2="20"/><line x1="10" y1="11" x2="10" y2="20"/><line x1="14" y1="11" x2="14" y2="20"/><line x1="18" y1="11" x2="18" y2="20"/><polygon points="12 2 2 7 22 7 12 2"/>`,
      minLength: 4,
      errorEmpty: 'Please enter your Admin ID.',
      errorInvalid: 'Admin ID must be at least 4 characters long.'
    }
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const roleCards = document.querySelectorAll('.role-card');
  const loginForm = document.getElementById('loginForm');
  const identifierLabel = document.getElementById('identifierLabel');
  const identifierInput = document.getElementById('identifierInput');
  const identifierIcon = document.getElementById('identifierIcon');
  const identifierError = document.getElementById('identifierError');
  const clearIdentifierBtn = document.getElementById('clearIdentifierBtn');

  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
  const eyeOffIcon = togglePasswordBtn.querySelector('.eye-off-icon');

  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn.querySelector('.btn-text');
  const spinner = loginBtn.querySelector('.spinner');

  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');

  const registerUserLink = document.getElementById('registerUserLink');
  const registerDistributorLink = document.getElementById('registerDistributorLink');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  const infoModal = document.getElementById('infoModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const confirmModalBtn = document.getElementById('confirmModalBtn');

  // =========================================================================
  // ROLE SELECTION LOGIC
  // =========================================================================
  function updateRole(newRole) {
    if (!roleConfigs[newRole]) return;

    selectedRole = newRole;
    const config = roleConfigs[newRole];

    // Update Role Cards UI
    roleCards.forEach(card => {
      const isSelected = card.getAttribute('data-role') === newRole;
      if (isSelected) {
        card.classList.add('active');
        card.setAttribute('aria-checked', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-checked', 'false');
      }
    });

    // Update Input 1 Label, Placeholder & Icon
    identifierLabel.innerHTML = `${config.label} <span class="required">*</span>`;
    identifierInput.placeholder = config.placeholder;
    identifierIcon.innerHTML = config.iconSvg;

    // Reset validation states on role switch
    clearErrors();
    hideAlert();
  }

  // Attach Click & Keyboard event listeners to Role Cards
  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      const role = card.getAttribute('data-role');
      updateRole(role);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const role = card.getAttribute('data-role');
        updateRole(role);
      }
    });
  });

  // =========================================================================
  // INPUT HELPERS (Clear text & Toggle Password)
  // =========================================================================
  identifierInput.addEventListener('input', () => {
    if (identifierInput.value.trim().length > 0) {
      clearIdentifierBtn.classList.remove('hidden');
    } else {
      clearIdentifierBtn.classList.add('hidden');
    }
    clearFieldError(identifierInput, identifierError);
  });

  clearIdentifierBtn.addEventListener('click', () => {
    identifierInput.value = '';
    clearIdentifierBtn.classList.add('hidden');
    identifierInput.focus();
    clearFieldError(identifierInput, identifierError);
  });

  passwordInput.addEventListener('input', () => {
    clearFieldError(passwordInput, passwordError);
  });

  // Toggle Password Visibility
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    if (isPassword) {
      eyeIcon.classList.add('hidden');
      eyeOffIcon.classList.remove('hidden');
    } else {
      eyeIcon.classList.remove('hidden');
      eyeOffIcon.classList.add('hidden');
    }
  });

  // =========================================================================
  // BUTTON RIPPLE EFFECT
  // =========================================================================
  loginBtn.addEventListener('click', function (e) {
    const rect = loginBtn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ripple = document.createElement('span');
    ripple.classList.add('ripple-circle');
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    this.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });

  // =========================================================================
  // VALIDATION LOGIC
  // =========================================================================
  function showFieldError(inputElem, errorElem, message) {
    inputElem.classList.add('is-invalid');
    errorElem.textContent = message;
  }

  function clearFieldError(inputElem, errorElem) {
    inputElem.classList.remove('is-invalid');
    errorElem.textContent = '';
  }

  function clearErrors() {
    clearFieldError(identifierInput, identifierError);
    clearFieldError(passwordInput, passwordError);
  }

  function showAlert(message, type = 'error') {
    alertBox.classList.remove('hidden', 'error-alert', 'success-alert');
    alertBox.classList.add(`${type}-alert`);
    alertMessage.textContent = message;
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }

  function triggerShake() {
    loginForm.classList.remove('shake');
    // Force reflow
    void loginForm.offsetWidth;
    loginForm.classList.add('shake');
    setTimeout(() => {
      loginForm.classList.remove('shake');
    }, 400);
  }

  // =========================================================================
  // FORM SUBMISSION (Ready for Node.js / MongoDB API integration)
  // =========================================================================
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    hideAlert();

    const config = roleConfigs[selectedRole];
    const identifierVal = identifierInput.value.trim();
    const passwordVal = passwordInput.value.trim();

    let isValid = true;
    let firstErrorField = null;

    // Validate 1: Selected Role check
    if (!selectedRole || !roleConfigs[selectedRole]) {
      showAlert('Please select a valid user role to proceed.', 'error');
      triggerShake();
      return;
    }

    // Validate 2: Identifier Input (Ration Card No / Distributor ID / Admin ID)
    if (!identifierVal) {
      showFieldError(identifierInput, identifierError, config.errorEmpty);
      isValid = false;
      if (!firstErrorField) firstErrorField = identifierInput;
    } else if (identifierVal.length < config.minLength) {
      showFieldError(identifierInput, identifierError, config.errorInvalid);
      isValid = false;
      if (!firstErrorField) firstErrorField = identifierInput;
    }

    // Validate 3: Password Input
    if (!passwordVal) {
      showFieldError(passwordInput, passwordError, 'Please enter your password.');
      isValid = false;
      if (!firstErrorField) firstErrorField = passwordInput;
    } else if (passwordVal.length < 6) {
      showFieldError(passwordInput, passwordError, 'Password must be at least 6 characters.');
      isValid = false;
      if (!firstErrorField) firstErrorField = passwordInput;
    }

    // If validation failed
    if (!isValid) {
      showAlert('Please correct the highlighted errors before submitting.', 'error');
      triggerShake();
      if (firstErrorField) firstErrorField.focus();
      return;
    }

    // =======================================================================
    // REAL BACKEND API AUTHENTICATION
    // Calls POST /api/auth/admin/login, POST /api/auth/distributor/login, or POST /api/auth/beneficiary/login
    // =======================================================================
    // Show Loading UI
    loginBtn.disabled = true;
    btnText.textContent = 'Authenticating...';
    spinner.classList.remove('hidden');

    (async () => {
      try {
        let response;
        if (selectedRole === 'admin') {
          response = await authApi.adminLogin({
            adminId: identifierVal,
            password: passwordVal,
          });
        } else if (selectedRole === 'distributor') {
          response = await authApi.distributorLogin({
            distributorId: identifierVal,
            password: passwordVal,
          });
        } else {
          response = await authApi.beneficiaryLogin({
            rationCardNumber: identifierVal,
            password: passwordVal,
          });
        }

        showAlert(`Welcome! Authentication successful as ${selectedRole.toUpperCase()}. Redirecting to portal...`, 'success');

        // Clear fields
        passwordInput.value = '';

        // Redirect to respective dashboard after authorization
        setTimeout(() => {
          if (selectedRole === 'admin') {
            window.location.href = 'admin-dashboard.html';
          } else if (selectedRole === 'distributor') {
            window.location.href = 'distributor-dashboard.html';
          } else {
            window.location.href = 'beneficiary-dashboard.html';
          }
        }, 500);

      } catch (err) {
        const errorMsg = err.message || 'Authentication failed. Please verify your credentials.';
        showAlert(errorMsg, 'error');
        triggerShake();
      } finally {
        loginBtn.disabled = false;
        btnText.textContent = 'Sign In';
        spinner.classList.add('hidden');
      }
    })();
  });

  // =========================================================================
  // BOTTOM LINKS & MODALS (User, Distributor, Forgot Password)
  // =========================================================================
  function openModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    infoModal.classList.remove('hidden');
  }

  function closeModal() {
    infoModal.classList.add('hidden');
  }

  closeModalBtn.addEventListener('click', closeModal);
  confirmModalBtn.addEventListener('click', closeModal);
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) closeModal();
  });

  if (registerUserLink) {
    registerUserLink.addEventListener('click', () => {
      window.location.href = 'register-user.html';
    });
  }

  if (registerDistributorLink) {
    registerDistributorLink.addEventListener('click', () => {
      window.location.href = 'register-distributor.html';
    });
  }

  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    const config = roleConfigs[selectedRole];
    openModal(
      'Password Reset Request',
      `You are requesting a password reset for <strong>${selectedRole.toUpperCase()}</strong> role.<br><br>An OTP will be sent to the mobile number registered with your <strong>${config.label}</strong>.<br><br>Contact your district food supply office if your mobile number has changed.`
    );
  });

  // Initialize with 'user' role
  updateRole('user');
});
