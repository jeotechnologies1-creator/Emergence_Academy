/* ==========================================================
   EMERGENCE ACADEMY
   ROLE ROUTER
========================================================== */


const RoleRouter = {


async redirect(){


    const role = await Profile.getRole();



    switch(role){


        case "admin":

            this.loadAdmin();

            break;



        case "teacher":

            this.loadTeacher();

            break;



        case "student":

            this.loadStudent();

            break;



        case "parent":

            this.loadParent();

            break;



        default:

            console.warn(
                "Unknown user role:",
                role
            );

    }



},



loadAdmin(){

    document.body.dataset.role="admin";


    console.log(
        "Admin dashboard loaded"
    );

},



loadTeacher(){

    document.body.dataset.role="teacher";


    console.log(
        "Teacher dashboard loaded"
    );

},



loadStudent(){

    document.body.dataset.role="student";


    console.log(
        "Student dashboard loaded"
    );

},



loadParent(){

    document.body.dataset.role="parent";


    console.log(
        "Parent dashboard loaded"
    );

}



};



window.RoleRouter = RoleRouter;