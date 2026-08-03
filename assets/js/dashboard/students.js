/* ==========================================================
   EMERGENCE ACADEMY
   STUDENTS MODULE
========================================================== */

class StudentsModule {

    static students = [];

    static classes = [];

    static currentPage = 1;

    static pageSize = 10;

    /* ==========================================
       RENDER
    ========================================== */

    static async render(container) {

        container.innerHTML = this.loading();

        try {

            await this.load();

            container.innerHTML = this.template();

            this.events();

        }

        catch (error) {

            console.error(error);

            container.innerHTML = this.error();

        }

    }

    /* ==========================================
       LOAD DATA
    ========================================== */

    static async load() {

        const [

            students,

            classes

        ] = await Promise.all([

            API.students.getAll(),

            API.classes.getAll()

        ]);

        this.students = students;

        this.classes = classes;

    }
    static template() {

        return `

<div class="space-y-6">

<div class="flex justify-between items-center">

<h2 class="text-3xl font-bold">

Students

</h2>

<button

id="addStudent"

class="bg-blue-600 text-white px-5 py-2 rounded"

>

Add Student

</button>

</div>

<div class="bg-white rounded-lg shadow p-5">

<input

id="studentSearch"

type="text"

placeholder="Search students..."

class="w-full border rounded px-4 py-2 mb-4"

>

<div id="studentTable">

${this.table()}

</div>

</div>

</div>

`;

    }
    static table() {

        if (this.students.length === 0) {

            return `

<p class="text-center">

No students found.

</p>

`;

        }

        return `

<table class="w-full">

<thead>

<tr>

<th>Name</th>

<th>Class</th>

<th>Email</th>

<th>Phone</th>

<th></th>

</tr>

</thead>

<tbody>

${this.filteredStudents().map(student => `

<tr class="border-b">

<td class="px-4 py-3">

${student.student_no || "-"}

</td>

<td class="px-4 py-3">

${student.profiles?.first_name || ""}

${student.profiles?.last_name || ""}

</td>

<td class="px-4 py-3">

${student.profiles?.email || "-"}

</td>

<td class="px-4 py-3">

${student.classes?.class_name || "-"}

</td>

<td class="px-4 py-3">

${student.status}

</td>

<td class="px-4 py-3">

<button
class="editStudent text-blue-600 mr-3"
data-id="${student.id}">

Edit

</button>

<button
class="deleteStudent text-red-600"
data-id="${student.id}">

Delete

</button>

</td>

</tr>

`).join("")}

</tbody>

</table>

`;

    }
    static events() {
        document

            .getElementById("addStudent")

        ?.addEventListener(

            "click",

            () => {

                this.openAdmissionForm();

            }

        );

    }

    static async search(keyword) {

        if (keyword === "") {

            await this.load();

        }

        else {

            this.students =

                await Students.search(

                    keyword

                );

        }

        document

            .getElementById(

                "studentTable"

            )

            .innerHTML = this.table();

    }
    static loading() {

        return `

<div class="text-center py-20">

Loading Students...

</div>

`;

    }

    static error() {

        return `

<div class="text-center py-20 text-red-500">

Unable to load students.

</div>

`;

    }

}

window.StudentsModule = StudentsModule;