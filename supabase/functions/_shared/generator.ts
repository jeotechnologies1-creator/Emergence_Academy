export function randomPassword(length = 10) {

    const chars =

        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$#";

    let password = "";

    for (

        let i = 0;

        i < length;

        i++

    ) {

        password +=

            chars.charAt(

                Math.floor(

                    Math.random() *

                    chars.length

                )

            );

    }

    return password;

}

export async function generateAdmissionNumber(

    supabase: any

) {

    const year =

        new Date().getFullYear();

    const prefix = `EA${year}`;

    const {

        data

    } = await supabase

        .from("students")

        .select("admission_number")

        .like(

            "admission_number",

            `${prefix}%`

        )

        .order(

            "admission_number",

            {

                ascending: false

            }

        )

        .limit(1);

    let next = 1;

    if (

        data &&

        data.length

    ) {

        const last =

            data[0]

                .admission_number;

        next =

            parseInt(

                last.slice(-4)

            ) + 1;

    }

    return `${prefix}${String(next).padStart(4, "0")}`;

}