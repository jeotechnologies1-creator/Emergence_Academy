export function required(

    value: any,

    field: string

) {

    if (

        value === undefined ||

        value === null ||

        value === ""

    ) {

        throw new Error(`${field} is required`);

    }

}

export function validateStudent(data: any) {

    required(data.first_name, "First Name");

    required(data.last_name, "Last Name");

    required(data.email, "Email");

    required(data.class_id, "Class");

}