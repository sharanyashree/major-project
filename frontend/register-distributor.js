/**
 * Ration Distribution System - Distributor Registration Page Logic
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Connected to Express + MongoDB Backend API Endpoints
 */

import { authApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const registerForm = document.getElementById('registerDistributorForm');

  const fullNameInput = document.getElementById('fullNameInput');
  const fullNameError = document.getElementById('fullNameError');

  const distributorIdInput = document.getElementById('distributorIdInput');
  const distributorIdError = document.getElementById('distributorIdError');

  const fpsNameInput = document.getElementById('fpsNameInput');
  const fpsNameError = document.getElementById('fpsNameError');

  const mobileInput = document.getElementById('mobileInput');
  const mobileError = document.getElementById('mobileError');

  const emailInput = document.getElementById('emailInput');
  const emailError = document.getElementById('emailError');

  const districtInput = document.getElementById('districtInput');
  const districtError = document.getElementById('districtError');

  const talukInput = document.getElementById('talukInput');
  const talukError = document.getElementById('talukError');

  const villageInput = document.getElementById('villageInput');
  const villageError = document.getElementById('villageError');

  const addressInput = document.getElementById('addressInput');
  const addressError = document.getElementById('addressError');

  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');

  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');

  const termsCheck = document.getElementById('termsCheck');
  const termsError = document.getElementById('termsError');

  const registerBtn = document.getElementById('registerBtn');
  const btnText = registerBtn.querySelector('.btn-text');
  const spinner = registerBtn.querySelector('.spinner');

  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');

  const infoModal = document.getElementById('infoModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const confirmModalBtn = document.getElementById('confirmModalBtn');

  // =========================================================================
  // HELPER FUNCTIONS FOR ERRORS & ALERTS
  // =========================================================================
  function showFieldError(inputElem, errorElem, message) {
    if (inputElem) inputElem.classList.add('is-invalid');
    if (errorElem) errorElem.textContent = message;
  }

  function clearFieldError(inputElem, errorElem) {
    if (inputElem) inputElem.classList.remove('is-invalid');
    if (errorElem) errorElem.textContent = '';
  }

  function clearAllErrors() {
    const inputs = [
      [fullNameInput, fullNameError],
      [distributorIdInput, distributorIdError],
      [fpsNameInput, fpsNameError],
      [mobileInput, mobileError],
      [emailInput, emailError],
      [districtInput, districtError],
      [talukInput, talukError],
      [villageInput, villageError],
      [addressInput, addressError],
      [passwordInput, passwordError],
      [confirmPasswordInput, confirmPasswordError],
      [null, termsError]
    ];

    inputs.forEach(([inp, err]) => clearFieldError(inp, err));
    hideAlert();
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
    registerForm.classList.remove('shake');
    void registerForm.offsetWidth; // Force DOM reflow
    registerForm.classList.add('shake');
    setTimeout(() => {
      registerForm.classList.remove('shake');
    }, 400);
  }

  // Real-time validation clearance on typing
  const fieldPairs = [
    [fullNameInput, fullNameError],
    [distributorIdInput, distributorIdError],
    [fpsNameInput, fpsNameError],
    [mobileInput, mobileError],
    [emailInput, emailError],
    [districtInput, districtError],
    [talukInput, talukError],
    [villageInput, villageError],
    [addressInput, addressError],
    [passwordInput, passwordError],
    [confirmPasswordInput, confirmPasswordError]
  ];

  fieldPairs.forEach(([input, error]) => {
    if (input) {
      input.addEventListener('input', () => {
        clearFieldError(input, error);
      });
    }
  });

  termsCheck.addEventListener('change', () => {
    clearFieldError(null, termsError);
  });

  // Mobile number input formatting - strictly digits
  mobileInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // =========================================================================
  // TOGGLE PASSWORD VISIBILITY
  // =========================================================================
  function setupPasswordToggle(btn, input) {
    if (!btn || !input) return;
    const eyeIcon = btn.querySelector('.eye-icon');
    const eyeOffIcon = btn.querySelector('.eye-off-icon');

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      if (isPassword) {
        eyeIcon.classList.add('hidden');
        eyeOffIcon.classList.remove('hidden');
      } else {
        eyeIcon.classList.remove('hidden');
        eyeOffIcon.classList.add('hidden');
      }
    });
  }

  setupPasswordToggle(togglePasswordBtn, passwordInput);
  setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

  // =========================================================================
  // BUTTON RIPPLE ANIMATION
  // =========================================================================
  registerBtn.addEventListener('click', function (e) {
    const rect = registerBtn.getBoundingClientRect();
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
  // FORM VALIDATION & SUBMISSION
  // =========================================================================
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    let isValid = true;
    let firstErrorField = null;

    // 1. Full Name
    const fullNameVal = fullNameInput.value.trim();
    if (!fullNameVal) {
      showFieldError(fullNameInput, fullNameError, 'Please enter licensee full name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fullNameInput;
    } else if (fullNameVal.length < 3) {
      showFieldError(fullNameInput, fullNameError, 'Name must be at least 3 characters long.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fullNameInput;
    }

    // 2. Distributor ID Format (e.g. DIST-1234 or alphanumeric min 4 chars)
    const distributorIdVal = distributorIdInput.value.trim();
    const distIdRegex = /^[A-Za-z0-9\-]{4,20}$/;
    if (!distributorIdVal) {
      showFieldError(distributorIdInput, distributorIdError, 'Please enter your Distributor ID.');
      isValid = false;
      if (!firstErrorField) firstErrorField = distributorIdInput;
    } else if (!distIdRegex.test(distributorIdVal)) {
      showFieldError(distributorIdInput, distributorIdError, 'Distributor ID must be 4-20 alphanumeric characters (e.g. DIST-8842).');
      isValid = false;
      if (!firstErrorField) firstErrorField = distributorIdInput;
    }

    // 3. FPS Shop Name
    const fpsNameVal = fpsNameInput.value.trim();
    if (!fpsNameVal) {
      showFieldError(fpsNameInput, fpsNameError, 'Please enter Fair Price Shop (FPS) Name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fpsNameInput;
    } else if (fpsNameVal.length < 3) {
      showFieldError(fpsNameInput, fpsNameError, 'FPS Shop Name must be at least 3 characters.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fpsNameInput;
    }

    // 4. Mobile Number (10 digits starting with 6-9)
    const mobileVal = mobileInput.value.trim();
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileVal) {
      showFieldError(mobileInput, mobileError, 'Please enter your mobile number.');
      isValid = false;
      if (!firstErrorField) firstErrorField = mobileInput;
    } else if (!mobileRegex.test(mobileVal)) {
      showFieldError(mobileInput, mobileError, 'Enter a valid 10-digit mobile number starting with 6-9.');
      isValid = false;
      if (!firstErrorField) firstErrorField = mobileInput;
    }

    // 5. Email Address Format
    const emailVal = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal) {
      showFieldError(emailInput, emailError, 'Please enter your email address.');
      isValid = false;
      if (!firstErrorField) firstErrorField = emailInput;
    } else if (!emailRegex.test(emailVal)) {
      showFieldError(emailInput, emailError, 'Enter a valid email address (e.g., name@domain.com).');
      isValid = false;
      if (!firstErrorField) firstErrorField = emailInput;
    }

    // 6. District
    const districtVal = districtInput.value.trim();
    if (!districtVal) {
      showFieldError(districtInput, districtError, 'Please enter your district name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = districtInput;
    }

    // 7. Taluk
    const talukVal = talukInput.value.trim();
    if (!talukVal) {
      showFieldError(talukInput, talukError, 'Please enter your taluk name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = talukInput;
    }

    // 8. Village / Ward
    const villageVal = villageInput.value.trim();
    if (!villageVal) {
      showFieldError(villageInput, villageError, 'Please enter your village or ward name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = villageInput;
    }

    // 9. FPS Address
    const addressVal = addressInput.value.trim();
    if (!addressVal) {
      showFieldError(addressInput, addressError, 'Please enter the FPS store address.');
      isValid = false;
      if (!firstErrorField) firstErrorField = addressInput;
    } else if (addressVal.length < 8) {
      showFieldError(addressInput, addressError, 'Please provide a complete store address (min 8 characters).');
      isValid = false;
      if (!firstErrorField) firstErrorField = addressInput;
    }

    // 10. Password (Min 6 characters)
    const passwordVal = passwordInput.value.trim();
    if (!passwordVal) {
      showFieldError(passwordInput, passwordError, 'Please create a password.');
      isValid = false;
      if (!firstErrorField) firstErrorField = passwordInput;
    } else if (passwordVal.length < 6) {
      showFieldError(passwordInput, passwordError, 'Password must be at least 6 characters.');
      isValid = false;
      if (!firstErrorField) firstErrorField = passwordInput;
    }

    // 11. Confirm Password
    const confirmPasswordVal = confirmPasswordInput.value.trim();
    if (!confirmPasswordVal) {
      showFieldError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password.');
      isValid = false;
      if (!firstErrorField) firstErrorField = confirmPasswordInput;
    } else if (confirmPasswordVal !== passwordVal) {
      showFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match. Please check.');
      isValid = false;
      if (!firstErrorField) firstErrorField = confirmPasswordInput;
    }

    // Declaration Checkbox
    if (!termsCheck.checked) {
      showFieldError(null, termsError, 'You must certify your FPS Licensee details to proceed.');
      isValid = false;
    }

    // If validation failed
    if (!isValid) {
      showAlert('Please fix the errors in the registration form before submitting.', 'error');
      triggerShake();
      if (firstErrorField) firstErrorField.focus();
      return;
    }

    // =======================================================================
    // REAL BACKEND REGISTRATION (POST /api/auth/distributor/register)
    // =======================================================================
    const distributorPayload = {
      name: fullNameVal,
      distributorId: distributorIdVal.toUpperCase(),
      fpsCode: distributorIdVal.toUpperCase(),
      fpsName: fpsNameVal,
      mobileNumber: mobileVal,
      email: emailVal.toLowerCase(),
      district: districtVal,
      taluk: talukVal,
      village: villageVal,
      address: addressVal,
      password: passwordVal
    };

    // Loading State UI
    registerBtn.disabled = true;
    btnText.textContent = 'Creating FPS Account...';
    spinner.classList.remove('hidden');

    (async () => {
      try {
        const response = await authApi.registerDistributor(distributorPayload);

        showAlert(response.message || 'Distributor registration successful! Awaiting approval.', 'success');

        openModal(
          'FPS Distributor Registered!',
          `
            <p style="margin-bottom: 12px;">Welcome <strong>${fullNameVal}</strong>!</p>
            <p style="margin-bottom: 8px;">Your Fair Price Shop account <strong>${distributorIdVal.toUpperCase()}</strong> (${fpsNameVal}) has been submitted for admin approval.</p>
            <ul style="padding-left: 20px; margin-bottom: 16px; font-size: 0.875rem; color: #4B5563;">
              <li><strong>Distributor ID:</strong> ${distributorIdVal.toUpperCase()}</li>
              <li><strong>Mobile:</strong> ${mobileVal}</li>
              <li><strong>Location:</strong> ${talukVal}, ${districtVal}</li>
              <li><strong>Status:</strong> ${response.data?.status || 'Pending Admin Approval'}</li>
            </ul>
            <p style="font-size: 0.85rem; color: #6B7280;">Once an administrator activates your account, you will be able to log in with your credentials.</p>
          `
        );

        // Reset form
        registerForm.reset();
      } catch (err) {
        const errorMsg = err.message || 'Registration failed. Please check your information and try again.';
        showAlert(errorMsg, 'error');
        triggerShake();
      } finally {
        registerBtn.disabled = false;
        btnText.textContent = 'Register';
        spinner.classList.add('hidden');
      }
    })();
  });

  // =========================================================================
  // MODAL DIALOG & REDIRECT TO LOGIN
  // =========================================================================
  function openModal(title, htmlContent) {
    modalTitle.textContent = title;
    modalBody.innerHTML = htmlContent;
    infoModal.classList.remove('hidden');
  }

  function closeModalAndRedirect() {
    infoModal.classList.add('hidden');
    window.location.href = 'login.html';
  }

  closeModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
  confirmModalBtn.addEventListener('click', closeModalAndRedirect);
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) closeModalAndRedirect();
  });
});
