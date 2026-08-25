-- Populate the administrator's class directory. The subject catalog can
-- de-duplicate a shared subject name (for example Mathematics), so the lists
-- below deliberately resolve by subject name rather than its stored band.
with curriculum_groups (class_pattern, subject_names) as (
  values
    ('Primary %', array[
      'English Studies', 'Mathematics', 'Nigerian Language', 'Basic Science',
      'Social Studies', 'Cultural & Creative Arts', 'Physical & Health Education',
      'Christian Religious Studies / Islamic Studies', 'Computer/Digital Literacy',
      'Nigerian History', 'Religious Studies', 'Digital Technologies', 'Agriculture',
      'Civic & Values Education', 'Entrepreneurship & Financial Literacy'
    ]::text[]),
    ('JSS %', array[
      'English Language', 'Mathematics', 'Intermediate Science', 'Digital Technologies',
      'Nigerian History', 'Social Studies', 'Citizenship & Values Education',
      'Cultural & Creative Arts', 'Physical & Health Education', 'Religious Studies',
      'Christian Religious Studies', 'Islamic Studies', 'Nigerian Language', 'French',
      'Arabic', 'Agriculture', 'Business & Entrepreneurial Studies', 'Pre-vocational Studies'
    ]::text[]),
    ('SSS %', array[
      'English Language', 'General Mathematics', 'Citizenship and Heritage Studies',
      'Digital Technologies', 'One Trade Subject', 'Biology', 'Chemistry', 'Physics',
      'Agricultural Science', 'Further Mathematics', 'Physical Education',
      'Health Education', 'Foods & Nutrition', 'Geography', 'Technical Drawing',
      'Nigerian History', 'Government', 'Christian Religious Studies', 'Islamic Studies',
      'Nigerian Language', 'French', 'Arabic', 'Visual Arts', 'Music',
      'Literature-in-English', 'Home Management', 'Catering Craft', 'Accounting',
      'Commerce', 'Marketing', 'Economics',
      'Solar Photovoltaic Installation & Maintenance', 'Fashion Design & Garment Making',
      'Livestock Farming', 'Beauty & Cosmetology', 'Computer Hardware & GSM Repairs',
      'Horticulture & Crop Production'
    ]::text[])
)
insert into public.class_subjects (class_id, subject_id)
select distinct
  c.id,
  s.id
from public.classes c
join curriculum_groups g on c.class_name like g.class_pattern
join public.subjects s on s.subject_name = any(g.subject_names)
where c.class_name in (
  'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SSS 1', 'SSS 2', 'SSS 3'
)
on conflict (class_id, subject_id) do nothing;
