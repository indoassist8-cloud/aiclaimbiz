// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDt3AXqpQld8nklTfKwfEPIXf1VudcNqlM",
    authDomain: "fb-ocr-rc.firebaseapp.com",
    projectId: "fb-ocr-rc",
    storageBucket: "fb-ocr-rc.firebasestorage.app",
    messagingSenderId: "403801195570",
    appId: "1:403801195570:web:991fac0cc71b3f959e282b",
    measurementId: "G-8B6K8JE1TB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Helper function to show messages
function showMsg(msg, divId, isSuccess = false) {
    const msgDiv = document.getElementById(divId);
    msgDiv.style.display = "block";
    msgDiv.innerHTML = msg;
    msgDiv.className = isSuccess ? 'message-box success' : 'message-box';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        msgDiv.style.opacity = 0;
        setTimeout(() => {
            msgDiv.style.display = "none";
            msgDiv.style.opacity = 1;
        }, 300);
    }, 5000);
}

// Google Sign In
const btnGoogleLogin = document.getElementById('google-btn');
btnGoogleLogin.addEventListener('click', (event) => {
    event.preventDefault();
    
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    const db = getFirestore();
    
    signInWithPopup(auth, provider)
        .then(async (result) => {
            const user = result.user;
            
            // Extract name from Google profile
            const displayName = user.displayName || '';
            const nameParts = displayName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            // Save user data to Firestore
            const userData = {
                email: user.email,
                firstName: firstName,
                lastName: lastName,
                displayName: displayName,
                photoURL: user.photoURL || '',
                provider: 'google'
            };
            
            const docRef = doc(db, "users", user.uid);
            await setDoc(docRef, userData, { merge: true });
            
            showMsg('Successfully signed in with Google!', 'login-msg', true);
            localStorage.setItem('loggedInUserId', user.uid);
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        })
        .catch((error) => {
            console.error('Google sign in error:', error);
            showMsg('Failed to sign in with Google. Please try again.', 'login-msg');
        });
});

// Sign Up Form
const signupForm = document.querySelector('#signup-form');
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Get user data
    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName = document.getElementById('signup-lastname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pwd = document.getElementById('signup-password').value;

    // Validation
    if (!firstName || !lastName) {
        showMsg('Please enter your first and last name.', 'signup-msg');
        return;
    }

    if (pwd.length < 6) {
        showMsg('Password must be at least 6 characters long.', 'signup-msg');
        return;
    }

    const auth = getAuth();
    const db = getFirestore();

    // Disable button to prevent double submission
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    createUserWithEmailAndPassword(auth, email, pwd)
        .then(async (userCredential) => {
            const user = userCredential.user;
            
            // Prepare user data
            const userData = {
                email: email,
                firstName: firstName,
                lastName: lastName,
                displayName: `${firstName} ${lastName}`,
                provider: 'email',
                createdAt: new Date().toISOString()
            };

            // Save to Firestore
            const docRef = doc(db, "users", user.uid);
            await setDoc(docRef, userData);
            
            // Send verification email
            await user.sendEmailVerification();
            
            showMsg('Account created successfully! Please check your email for verification.', 'signup-msg', true);
            
            // Clear form
            signupForm.reset();
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                showForm('login-form');
            }, 2000);
        })
        .catch((error) => {
            const errorCode = error.code;
            let errorMessage = 'Unable to create account. Please try again.';
            
            if (errorCode === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (errorCode === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (errorCode === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use a stronger password.';
            }
            
            showMsg(errorMessage, 'signup-msg');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        });
});

// Sign In Form
const btnSignIn = document.getElementById('submitSignIn');
btnSignIn.addEventListener('click', (event) => {
    event.preventDefault();
    
    // Get user data
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;

    if (!email || !pwd) {
        showMsg('Please enter your email and password.', 'login-msg');
        return;
    }

    const auth = getAuth();
    
    // Disable button
    btnSignIn.disabled = true;
    btnSignIn.textContent = 'Signing in...';

    signInWithEmailAndPassword(auth, email, pwd)
        .then((userCredential) => {
            const user = userCredential.user;
            
            showMsg('Successfully signed in!', 'login-msg', true);
            localStorage.setItem('loggedInUserId', user.uid);
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        })
        .catch((error) => {
            const errorCode = error.code;
            let errorMessage = 'Sign in failed. Please try again.';
            
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password. Please check your credentials.';
            } else if (errorCode === 'auth/user-not-found') {
                errorMessage = 'No account found with this email. Please sign up first.';
            } else if (errorCode === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later.';
            }
            
            showMsg(errorMessage, 'login-msg');
        })
        .finally(() => {
            btnSignIn.disabled = false;
            btnSignIn.textContent = 'Sign in';
        });
});

// Forgot Password Form
const forgotForm = document.querySelector('#forgot-action');
forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
        showMsg('Please enter your email address.', 'forgot-msg');
        return;
    }

    const auth = getAuth();
    
    // Disable button
    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    sendPasswordResetEmail(auth, email)
        .then(() => {
            showMsg('Password reset link sent! Please check your email.', 'forgot-msg', true);
            
            // Clear form and redirect to login after 3 seconds
            forgotForm.reset();
            setTimeout(() => {
                showForm('login-form');
            }, 3000);
        })
        .catch((error) => {
            const errorCode = error.code;
            let errorMessage = 'Failed to send reset link. Please try again.';
            
            if (errorCode === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address.';
            } else if (errorCode === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (errorCode === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later.';
            }
            
            showMsg(errorMessage, 'forgot-msg');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send reset link';
        });
});
