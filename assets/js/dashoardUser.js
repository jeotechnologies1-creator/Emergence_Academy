/* ==========================================================
   DASHBOARD USER DISPLAY
========================================================== */


async function displayUser(){


    const profile = await Profile.load();



    if(!profile) return;



    const name =
    profile.full_name ||
    profile.name ||
    profile.email;



    const element =
    document.getElementById(
        "userName"
    );



    if(element){

        element.textContent=name;

    }


}


document.addEventListener(
"DOMContentLoaded",
displayUser
);