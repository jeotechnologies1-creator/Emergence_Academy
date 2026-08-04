/* ==========================================================
   EMERGENCE ACADEMY
   PROFILE MANAGEMENT
========================================================== */


const Profile = {


    async load(){


        const user = await Auth.getUser();


        if(!user){

            console.error(
                "No authenticated user found"
            );

            return null;

        }



        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();



        if(error){

            console.error(
                "Profile loading error:",
                error
            );

            return null;

        }



        window.currentProfile = data;


        return data;


    },



    async getRole(){


        if(!window.currentProfile){

            await this.load();

        }


        return window.currentProfile?.role || null;


    }



};



window.Profile = Profile;