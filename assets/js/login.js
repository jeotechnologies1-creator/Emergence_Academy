async function loginUser(email,password){

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({

        email,
        password

    });


    if(error){

        alert(error.message);
        return;

    }


    window.location.href="dashboard.html";

}