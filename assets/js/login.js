/* ==========================================================
   EMERGENCE ACADEMY
   LOGIN
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");

    const emailInput =
        document.getElementById("loginEmail");

    const passwordInput =
        document.getElementById("loginPassword");

    const roleInput =
        document.getElementById("loginRole");

    const errorBox =
        document.getElementById("loginError");

    const statusBox =
        document.getElementById("loginStatus");

    const togglePassword =
        document.getElementById("togglePassword");


    /* ==========================================
       SUPABASE STATUS
    ========================================== */

    if (statusBox) {

        statusBox.textContent =
            window.supabaseInitMessage ||
            "Connected";

    }


    /* ==========================================
       SHOW / HIDE PASSWORD
    ========================================== */

    if (togglePassword) {

        togglePassword.addEventListener(

            "click",

            () => {

                if (
                    passwordInput.type === "password"
                ) {

                    passwordInput.type = "text";

                    togglePassword.textContent =
                        "Hide";

                }

                else {

                    passwordInput.type =
                        "password";

                    togglePassword.textContent =
                        "Show";

                }

            }

        );

    }


    /* ==========================================
       LOGIN
    ========================================== */

    form.addEventListener(

        "submit",

        async (e) => {

            e.preventDefault();

            errorBox.classList.add("hidden");

            errorBox.textContent = "";


            const email =
                emailInput.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordInput.value;

            const role =
                roleInput.value;


            try {

                const result =
                    await Auth.login(

                        email,

                        password,

                        role

                    );

                if (!result.success) {

                    throw new Error(
                        result.message
                    );

                }

                await Auth.log(

                    "LOGIN",

                    `${result.profile.email}`

                );

                await Auth.redirect();

            }

            catch (err) {

                console.error(err);

                errorBox.textContent =

                    err.message ||

                    "Unable to login.";

                errorBox.classList.remove(

                    "hidden"

                );

            }

        }

    );

});