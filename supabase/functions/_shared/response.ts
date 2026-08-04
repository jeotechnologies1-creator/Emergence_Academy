import { corsHeaders } from "./cors.ts";

export function success(data: any) {

    return new Response(

        JSON.stringify({

            success: true,

            data

        }),

        {

            headers: {

                ...corsHeaders,

                "Content-Type": "application/json"

            }

        }

    );

}

export function failure(message: string, status = 400) {

    return new Response(

        JSON.stringify({

            success: false,

            message

        }),

        {

            status,

            headers: {

                ...corsHeaders,

                "Content-Type": "application/json"

            }

        }

    );

}