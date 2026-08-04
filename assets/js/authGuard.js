/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION GUARD
========================================================== */


async function requireAuth(){


    const session = await Auth.getSession();


    if(!session){

        window.location.href="login.html";

        return false;

    }


    return true;

}




async function redirectIfLoggedIn(){


    const session = await Auth.getSession();


    if(session){

        window.location.href="dashboard.html";

    }


}



window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;