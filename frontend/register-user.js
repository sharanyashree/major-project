/**
 * Ration Distribution System - User Registration Page Logic
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Connected to Express + MongoDB Backend API Endpoints
 */

import { authApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const registerForm = document.getElementById('registerUserForm');

  const fullNameInput = document.getElementById('fullNameInput');
  const fullNameError = document.getElementById('fullNameError');

  const rationCardInput = document.getElementById('rationCardInput');
  const rationCardError = document.getElementById('rationCardError');

  const mobileInput = document.getElementById('mobileInput');
  const mobileError = document.getElementById('mobileError');

  const familyMembersInput = document.getElementById('familyMembersInput');
  const familyMembersError = document.getElementById('familyMembersError');

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
      [rationCardInput, rationCardError],
      [mobileInput, mobileError],
      [familyMembersInput, familyMembersError],
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
    [rationCardInput, rationCardError],
    [mobileInput, mobileError],
    [familyMembersInput, familyMembersError],
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
      showFieldError(fullNameInput, fullNameError, 'Please enter your full name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fullNameInput;
    } else if (fullNameVal.length < 3) {
      showFieldError(fullNameInput, fullNameError, 'Full name must be at least 3 characters.');
      isValid = false;
      if (!firstErrorField) firstErrorField = fullNameInput;
    }

    // 2. Ration Card Number (OPTIONAL - assigned later by Admin via RFID)
    const rationCardVal = rationCardInput ? rationCardInput.value.trim() : '';
    if (rationCardVal && rationCardVal.length < 4) {
      showFieldError(rationCardInput, rationCardError, 'If entered, Ration Card Number must be at least 4 characters.');
      isValid = false;
      if (!firstErrorField) firstErrorField = rationCardInput;
    }

    // 3. Mobile Number (10 digits)
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

    // 4. Family Members
    const familyVal = parseInt(familyMembersInput.value.trim(), 10);
    if (!familyMembersInput.value.trim() || isNaN(familyVal)) {
      showFieldError(familyMembersInput, familyMembersError, 'Please enter family members count.');
      isValid = false;
      if (!firstErrorField) firstErrorField = familyMembersInput;
    } else if (familyVal < 1 || familyVal > 20) {
      showFieldError(familyMembersInput, familyMembersError, 'Family count must be between 1 and 20.');
      isValid = false;
      if (!firstErrorField) firstErrorField = familyMembersInput;
    }

    // 5. District
    const districtVal = districtInput.value.trim();
    if (!districtVal) {
      showFieldError(districtInput, districtError, 'Please enter your district name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = districtInput;
    }

    // 6. Taluk
    const talukVal = talukInput.value.trim();
    if (!talukVal) {
      showFieldError(talukInput, talukError, 'Please enter your taluk name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = talukInput;
    }

    // 7. Village
    const villageVal = villageInput.value.trim();
    if (!villageVal) {
      showFieldError(villageInput, villageError, 'Please enter your village or ward name.');
      isValid = false;
      if (!firstErrorField) firstErrorField = villageInput;
    }

    // 8. Address
    const addressVal = addressInput.value.trim();
    if (!addressVal) {
      showFieldError(addressInput, addressError, 'Please enter your full residential address.');
      isValid = false;
      if (!firstErrorField) firstErrorField = addressInput;
    } else if (addressVal.length < 8) {
      showFieldError(addressInput, addressError, 'Please provide a more detailed address (min 8 characters).');
      isValid = false;
      if (!firstErrorField) firstErrorField = addressInput;
    }

    // 9. Password
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

    // 10. Confirm Password
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
      showFieldError(null, termsError, 'You must accept the declaration to proceed.');
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
    // REAL BACKEND REGISTRATION (POST /api/auth/beneficiary/register)
    // =======================================================================
    const userRegistrationPayload = {
      fullName: fullNameVal,
      mobileNumber: mobileVal,
      familyMemberCount: familyVal,
      district: districtVal,
      taluk: talukVal,
      village: villageVal,
      address: addressVal,
      password: passwordVal,
    };
    if (rationCardVal) {
      userRegistrationPayload.rationCardNumber = rationCardVal.toUpperCase();
    }

    // Loading State UI
    registerBtn.disabled = true;
    btnText.textContent = 'Creating Account...';
    spinner.classList.remove('hidden');

    (async () => {
      try {
        const response = await authApi.registerBeneficiary(userRegistrationPayload);

        showAlert(response.message || 'Registration successful! Account has been created.', 'success');

        const cardDisplay = rationCardVal
          ? `<li><strong>Ration Card No:</strong> ${rationCardVal.toUpperCase()}</li>`
          : `<li><strong>Ration Card No:</strong> <span style="color: #D97706; font-style: italic;">Assigned later by Admin via RFID card</span></li>`;

        const loginInstruction = rationCardVal
          ? `You can now login using your Ration Card Number or Mobile Number and Password.`
          : `You can now login using your registered <strong>Mobile Number (${mobileVal})</strong> and Password. Your official Ration Card Number will be assigned by the Admin.`;

        openModal(
          'Account Registered Successfully!',
          `
            <p style="margin-bottom: 12px;">Welcome <strong>${fullNameVal}</strong>!</p>
            <p style="margin-bottom: 8px;">Your beneficiary account has been successfully registered.</p>
            <ul style="padding-left: 20px; margin-bottom: 16px; font-size: 0.875rem; color: #4B5563;">
              ${cardDisplay}
              <li><strong>Mobile:</strong> ${mobileVal}</li>
              <li><strong>Family Count:</strong> ${familyVal} Members</li>
              <li><strong>Location:</strong> ${villageVal}, ${talukVal}, ${districtVal}</li>
            </ul>
            <p style="font-size: 0.85rem; color: #6B7280;">${loginInstruction}</p>
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
