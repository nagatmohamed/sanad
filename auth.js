// ==========================================
// SANAD AUTHENTICATION SYSTEM
// ==========================================

import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    deleteUser
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
    ref,
    set,
    get,
    update,
    runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";


// ==========================================
// GENERATE UNIQUE CHILD CODE
// ==========================================

async function generateChildCode() {

    for (let i = 0; i < 10; i++) {

        const code = "SN-" + Math.floor(100000 + Math.random() * 900000);

        const codeRef = ref(db, "childCodes/" + code);

        const result = await runTransaction(codeRef, function (currentData) {

            if (currentData === null) {
                return "pending";
            }

            return;

        });

        if (result.committed && result.snapshot.val() === "pending") {
            return code;
        }

    }

    throw new Error("تعذر إنشاء كود الطفل، حاول مرة أخرى.");

}


// ==========================================
// REGISTER USER ACCOUNT
// ==========================================

async function registerAccount(userData) {

    let createdUser = null;
    let generatedCode = null;

    try {

        const userCredential = await createUserWithEmailAndPassword(
            auth,
            userData.email.trim().toLowerCase(),
            userData.password
        );

        createdUser = userCredential.user;

        const uid = createdUser.uid;

        let childCode = null;

        if (userData.accountType === "user") {
            childCode = await generateChildCode();
            generatedCode = childCode;
        }

        const profileData = { ...userData };

        delete profileData.password;
        delete profileData.confirmPassword;

        profileData.uid = uid;
        profileData.createdAt = new Date().toISOString();

        if (childCode) {
            profileData.childCode = childCode;
        }

        // Save profile
        await set(ref(db, "users/" + uid), profileData);

        // Save child code
        if (childCode) {
            await set(ref(db, "childCodes/" + childCode), uid);
        }

        // Save local session
        localStorage.setItem(
            "sanadCurrentUser",
            JSON.stringify(profileData)
        );

        localStorage.setItem(
            "sanadUsers",
            JSON.stringify([profileData])
        );

        return {
            success: true,
            user: profileData
        };

    } catch (error) {

        // Cleanup if registration failed
        if (createdUser) {

            try {

                if (generatedCode) {
                    await set(
                        ref(db, "childCodes/" + generatedCode),
                        null
                    );
                }

                await deleteUser(createdUser);

            } catch (deleteError) {

                console.error("Cleanup error:", deleteError);

            }

        }

        let message = "حدث خطأ أثناء إنشاء الحساب.";

        if (error.code === "auth/email-already-in-use") {
            message = "البريد الإلكتروني مسجل بالفعل.";
        }

        if (error.code === "auth/invalid-email") {
            message = "البريد الإلكتروني غير صحيح.";
        }

        if (error.code === "auth/weak-password") {
            message = "كلمة المرور ضعيفة، استخدم 6 أحرف على الأقل.";
        }

        if (error.code === "auth/network-request-failed") {
            message = "تأكد من اتصالك بالإنترنت وحاول مرة أخرى.";
        }

        if (error.message && error.message.includes("كود الطفل")) {
            message = error.message;
        }

        console.error(error);

        return {
            success: false,
            message: message
        };

    }

}


// ==========================================
// REGISTER FAMILY ACCOUNT
// ==========================================

async function registerFamilyAccount(familyData) {

    let createdUser = null;

    try {

        // Normalize child code
        const childCode = familyData.childCode
            .trim()
            .toUpperCase();

        // Check child code
        const codeSnapshot = await get(
            ref(db, "childCodes/" + childCode)
        );

        if (!codeSnapshot.exists()) {

            return {
                success: false,
                message: "كود الطفل غير صحيح، تأكدي من الكود وحاولي مرة أخرى."
            };

        }

        // Get child UID
        const childUID = codeSnapshot.val();

        // Get child profile
        const childSnapshot = await get(
            ref(db, "users/" + childUID)
        );

        if (!childSnapshot.exists()) {

            return {
                success: false,
                message: "لم نتمكن من العثور على حساب الطفل المرتبط بهذا الكود."
            };

        }

        const childData = childSnapshot.val();

        // Create family account
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            familyData.email.trim().toLowerCase(),
            familyData.password
        );

        createdUser = userCredential.user;

        const familyUID = createdUser.uid;

        // Prepare family profile
        const profileData = { ...familyData };

        delete profileData.password;
        delete profileData.confirmPassword;

        profileData.uid = familyUID;
        profileData.accountType = "family";
        profileData.childCode = childCode;
        profileData.linkedChildId = childUID;
        profileData.linkedChildName = childData.fullName || "";
        profileData.createdAt = new Date().toISOString();

        // Save family profile
        await set(
            ref(db, "users/" + familyUID),
            profileData
        );

        // Save child-family connection
        await set(
            ref(db, "childLinks/" + childUID + "/" + familyUID),
            {
                familyUID: familyUID,
                familyName: profileData.fullName,
                relationship: profileData.relationship,
                createdAt: profileData.createdAt
            }
        );

        // Save local session
        localStorage.setItem(
            "sanadCurrentUser",
            JSON.stringify(profileData)
        );

        localStorage.setItem(
            "sanadUsers",
            JSON.stringify([profileData])
        );

        return {
            success: true,
            user: profileData,
            child: childData
        };

    } catch (error) {

        // Delete Auth account if registration failed
        if (createdUser) {

            try {

                await deleteUser(createdUser);

            } catch (deleteError) {

                console.error("Cleanup error:", deleteError);

            }

        }

        let message = "حدث خطأ أثناء إنشاء حساب الأسرة.";

        if (error.code === "auth/email-already-in-use") {
            message = "البريد الإلكتروني مسجل بالفعل.";
        }

        if (error.code === "auth/invalid-email") {
            message = "البريد الإلكتروني غير صحيح.";
        }

        if (error.code === "auth/weak-password") {
            message = "كلمة المرور ضعيفة، استخدم 6 أحرف على الأقل.";
        }

        if (error.code === "auth/network-request-failed") {
            message = "تأكد من اتصالك بالإنترنت وحاول مرة أخرى.";
        }

        console.error(error);

        return {
            success: false,
            message: message
        };

    }

}


// ==========================================
// LOGIN ACCOUNT
// ==========================================

async function loginAccount(email, password) {

    try {

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email.trim().toLowerCase(),
            password
        );

        const uid = userCredential.user.uid;

        const snapshot = await get(
            ref(db, "users/" + uid)
        );

        if (!snapshot.exists()) {

            return {
                success: false,
                message: "بيانات الحساب غير موجودة."
            };

        }

        const userData = snapshot.val();

        localStorage.setItem(
            "sanadCurrentUser",
            JSON.stringify(userData)
        );

        localStorage.setItem(
            "sanadUsers",
            JSON.stringify([userData])
        );

        return {
            success: true,
            user: userData
        };

    } catch (error) {

        console.error(error);

        let message = "حدث خطأ أثناء تسجيل الدخول.";

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {

            message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

        }

        if (error.code === "auth/invalid-email") {
            message = "البريد الإلكتروني غير صحيح.";
        }

        if (error.code === "auth/network-request-failed") {
            message = "تأكد من اتصالك بالإنترنت.";
        }

        return {
            success: false,
            message: message
        };

    }

}


// ==========================================
// GET USER PROFILE
// ==========================================

async function getUserProfile(uid) {

    const snapshot = await get(
        ref(db, "users/" + uid)
    );

    if (snapshot.exists()) {
        return snapshot.val();
    }

    return null;

}


// ==========================================
// UPDATE USER PROFILE
// ==========================================

async function saveUserProfile(uid, userData) {

    await update(
        ref(db, "users/" + uid),
        userData
    );

}


// ==========================================
// LOGOUT
// ==========================================

async function logoutAccount() {

    await signOut(auth);

    localStorage.removeItem("sanadCurrentUser");
    localStorage.removeItem("sanadUsers");

}


// ==========================================
// EXPORT FUNCTIONS
// ==========================================

export {
    registerAccount,
    registerFamilyAccount,
    loginAccount,
    getUserProfile,
    saveUserProfile,
    logoutAccount,
    generateChildCode
};