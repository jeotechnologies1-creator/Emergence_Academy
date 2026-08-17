-- ============================================================
-- EMERGENCE ACADEMY
-- STUDENT ENROLLMENT AUTO-CONNECTION
-- ============================================================
--
-- PURPOSE
-- -------
-- When a student is created from the admin admission process,
-- the student currently gets a record in:
--
--     profiles
--     students
--
-- but may not get a record in:
--
--     student_enrollments
--
-- This causes modules that depend on formal enrollment/session
-- information to fail to recognize the student.
--
-- This migration fixes that WITHOUT changing the existing
-- admit_student() function.
--
-- It will:
--
-- 1. Create a helper function for current academic session.
-- 2. Automatically create student_enrollments when a student
--    is created with a class.
-- 3. Automatically create/update enrollment when class_id changes.
-- 4. Backfill existing students that are missing enrollment.
-- 5. Backfill again whenever the school's current session changes.
-- 6. Prevent duplicate student/class/session enrollments.
--
-- ============================================================


-- ============================================================
-- 1. HELPER FUNCTION
--    GET CURRENT ACADEMIC SESSION
-- ============================================================

create or replace function public.get_current_academic_session_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select ss.current_session
    from public.school_settings ss
    where ss.current_session is not null
    order by ss.updated_at desc nulls last
    limit 1;
$$;


-- ============================================================
-- 2. PREVENT DUPLICATE ENROLLMENTS
--
-- Your schema already has:
--
-- student_enrollments
--   student_id
--   class_id
--   session_id
--
-- but it does not have a unique constraint for the combination.
--
-- First remove duplicates if any exist.
-- The oldest record is retained.
-- ============================================================

delete from public.student_enrollments se
where se.id in (
    select id
    from (
        select
            id,
            row_number() over (
                partition by student_id, class_id, session_id
                order by enrolled_at asc nulls last, id asc
            ) as row_num
        from public.student_enrollments
    ) duplicates
    where duplicates.row_num > 1
);


-- ============================================================
-- 3. CREATE UNIQUE INDEX
-- ============================================================

create unique index if not exists
student_enrollments_student_class_session_unique
on public.student_enrollments (
    student_id,
    class_id,
    session_id
);


-- ============================================================
-- 4. CREATE USEFUL LOOKUP INDEXES
-- ============================================================

create index if not exists
student_enrollments_student_id_idx
on public.student_enrollments(student_id);

create index if not exists
student_enrollments_class_id_idx
on public.student_enrollments(class_id);

create index if not exists
student_enrollments_session_id_idx
on public.student_enrollments(session_id);


-- ============================================================
-- 5. FUNCTION
--    ENSURE STUDENT HAS CURRENT SESSION ENROLLMENT
-- ============================================================

create or replace function public.ensure_student_enrollment(
    p_student_id uuid,
    p_class_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_session_id uuid;
    v_enrollment_id uuid;
begin

    -- Nothing to do without a student.
    if p_student_id is null then
        return null;
    end if;

    -- Nothing to do without a class.
    if p_class_id is null then
        return null;
    end if;


    -- Get the school's current academic session.
    select public.get_current_academic_session_id()
    into v_session_id;


    -- If no current session has been configured,
    -- do not create an invalid enrollment.
    if v_session_id is null then
        return null;
    end if;


    -- Make sure the student exists.
    if not exists (
        select 1
        from public.students
        where id = p_student_id
    ) then
        raise exception
            'Cannot create enrollment: student does not exist.';
    end if;


    -- Make sure the class exists.
    if not exists (
        select 1
        from public.classes
        where id = p_class_id
    ) then
        raise exception
            'Cannot create enrollment: class does not exist.';
    end if;


    -- Check whether the enrollment already exists.
    select se.id
    into v_enrollment_id
    from public.student_enrollments se
    where se.student_id = p_student_id
      and se.class_id = p_class_id
      and se.session_id = v_session_id
    limit 1;


    -- Already enrolled.
    if v_enrollment_id is not null then
        return v_enrollment_id;
    end if;


    -- Create the missing enrollment.
    insert into public.student_enrollments (
        student_id,
        class_id,
        session_id,
        enrolled_at
    )
    values (
        p_student_id,
        p_class_id,
        v_session_id,
        now()
    )
    on conflict (
        student_id,
        class_id,
        session_id
    )
    do nothing
    returning id
    into v_enrollment_id;


    -- Handle a race condition where another request
    -- created the enrollment at the same time.
    if v_enrollment_id is null then
        select se.id
        into v_enrollment_id
        from public.student_enrollments se
        where se.student_id = p_student_id
          and se.class_id = p_class_id
          and se.session_id = v_session_id
        limit 1;
    end if;


    return v_enrollment_id;

end;
$$;


-- ============================================================
-- 6. TRIGGER FUNCTION
--
-- This runs automatically whenever:
--
-- INSERT INTO students
--
-- or
--
-- UPDATE students.class_id
--
-- happens.
-- ============================================================

create or replace function public.auto_enroll_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    -- Only create enrollment when a class is assigned.
    if new.class_id is not null then

        perform public.ensure_student_enrollment(
            new.id,
            new.class_id
        );

    end if;

    return new;

end;
$$;


-- ============================================================
-- 7. REMOVE OLD VERSION OF THE TRIGGER IF IT EXISTS
-- ============================================================

drop trigger if exists
student_auto_enrollment_trigger
on public.students;


-- ============================================================
-- 8. CREATE THE STUDENT ENROLLMENT TRIGGER
-- ============================================================

create trigger
student_auto_enrollment_trigger
after insert or update of class_id
on public.students
for each row
execute function public.auto_enroll_student();


-- ============================================================
-- 9. BACKFILL EXISTING STUDENTS
--
-- This fixes students who were already admitted before this
-- SQL was installed.
-- ============================================================

do $$
declare
    student_record record;
begin

    for student_record in
        select
            s.id as student_id,
            s.class_id
        from public.students s
        where s.class_id is not null
    loop

        perform public.ensure_student_enrollment(
            student_record.student_id,
            student_record.class_id
        );

    end loop;

end;
$$;


-- ============================================================
-- 10. TRIGGER FUNCTION FOR CURRENT SESSION CHANGES
--
-- If the admin changes:
--
-- school_settings.current_session
--
-- all students who already have a class will automatically
-- receive an enrollment for the new session.
-- ============================================================

create or replace function public.auto_enroll_students_for_current_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    student_record record;
begin

    -- Only do the work when the current session changes.
    if new.current_session is distinct from old.current_session then

        for student_record in
            select
                s.id as student_id,
                s.class_id
            from public.students s
            where s.class_id is not null
        loop

            perform public.ensure_student_enrollment(
                student_record.student_id,
                student_record.class_id
            );

        end loop;

    end if;

    return new;

end;
$$;


-- ============================================================
-- 11. REMOVE OLD SCHOOL SESSION TRIGGER IF IT EXISTS
-- ============================================================

drop trigger if exists
school_settings_auto_student_enrollment_trigger
on public.school_settings;


-- ============================================================
-- 12. CREATE SCHOOL SESSION TRIGGER
-- ============================================================

create trigger
school_settings_auto_student_enrollment_trigger
after update of current_session
on public.school_settings
for each row
execute function public.auto_enroll_students_for_current_session();


-- ============================================================
-- 13. OPTIONAL: ALSO HANDLE INSERT INTO SCHOOL_SETTINGS
--
-- If the school_settings row is created after students already
-- exist, create their current-session enrollments.
-- ============================================================

create or replace function public.auto_enroll_students_after_school_settings_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    student_record record;
begin

    if new.current_session is not null then

        for student_record in
            select
                s.id as student_id,
                s.class_id
            from public.students s
            where s.class_id is not null
        loop

            perform public.ensure_student_enrollment(
                student_record.student_id,
                student_record.class_id
            );

        end loop;

    end if;

    return new;

end;
$$;


drop trigger if exists
school_settings_insert_student_enrollment_trigger
on public.school_settings;


create trigger
school_settings_insert_student_enrollment_trigger
after insert
on public.school_settings
for each row
execute function public.auto_enroll_students_after_school_settings_insert();


-- ============================================================
-- 14. VERIFY / REPAIR CURRENT DATA
--
-- Run one final backfill after all triggers/functions have
-- been installed.
-- ============================================================

do $$
declare
    student_record record;
begin

    for student_record in
        select
            s.id as student_id,
            s.class_id
        from public.students s
        where s.class_id is not null
    loop

        perform public.ensure_student_enrollment(
            student_record.student_id,
            student_record.class_id
        );

    end loop;

end;
$$;


-- ============================================================
-- 15. COMMENTS
-- ============================================================

comment on function public.get_current_academic_session_id()
is
'Returns the academic session configured as the current session in school_settings.';


comment on function public.ensure_student_enrollment(uuid, uuid)
is
'Creates the current-session student enrollment if it does not already exist.';


comment on function public.auto_enroll_student()
is
'Automatically creates a current-session enrollment whenever a student is admitted or assigned to a class.';


-- ============================================================
-- END OF STUDENT ENROLLMENT FIX
-- ============================================================