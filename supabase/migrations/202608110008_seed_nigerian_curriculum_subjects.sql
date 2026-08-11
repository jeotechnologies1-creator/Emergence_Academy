-- Make the curriculum structure explicit so the dashboard can distinguish a
-- subject taught at different levels or in different senior-school tracks.
alter table public.subjects
  add column if not exists curriculum_band text,
  add column if not exists curriculum_level text,
  add column if not exists curriculum_track text;

create index if not exists subjects_curriculum_directory_idx
  on public.subjects (curriculum_band, curriculum_level, curriculum_track, subject_name);

-- The source table already exposes subject_code to the dashboard. Codes here
-- are stable, compact identifiers, while subject_name remains the display name.
with curriculum (curriculum_band, curriculum_level, curriculum_track, subject_names) as (
  values
    ('Primary', 'Primary 3', 'Core', array[
      'English Studies', 'Mathematics', 'Nigerian Language', 'Basic Science',
      'Social Studies', 'Cultural & Creative Arts', 'Physical & Health Education',
      'Christian Religious Studies / Islamic Studies', 'Computer/Digital Literacy'
    ]::text[]),
    ('Primary', 'Primary 4', 'Core', array[
      'English Studies', 'Mathematics', 'Nigerian Language', 'Basic Science',
      'Social Studies', 'Nigerian History', 'Cultural & Creative Arts',
      'Physical & Health Education', 'Religious Studies', 'Digital Technologies',
      'Agriculture', 'Civic & Values Education', 'Entrepreneurship & Financial Literacy'
    ]::text[]),
    ('Primary', 'Primary 5', 'Core', array[
      'English Studies', 'Mathematics', 'Nigerian Language', 'Basic Science',
      'Social Studies', 'Nigerian History', 'Cultural & Creative Arts',
      'Physical & Health Education', 'Religious Studies', 'Digital Technologies',
      'Agriculture', 'Civic & Values Education', 'Entrepreneurship & Financial Literacy'
    ]::text[]),
    ('Primary', 'Primary 6', 'Core', array[
      'English Studies', 'Mathematics', 'Nigerian Language', 'Basic Science',
      'Social Studies', 'Nigerian History', 'Cultural & Creative Arts',
      'Physical & Health Education', 'Religious Studies', 'Digital Technologies',
      'Agriculture', 'Civic & Values Education', 'Entrepreneurship & Financial Literacy'
    ]::text[]),
    ('Junior Secondary', 'JSS 1', 'Core', array[
      'English Language', 'Mathematics', 'Intermediate Science', 'Digital Technologies',
      'Nigerian History', 'Social Studies', 'Citizenship & Values Education',
      'Cultural & Creative Arts', 'Physical & Health Education', 'Religious Studies',
      'Christian Religious Studies', 'Islamic Studies', 'Nigerian Language', 'French',
      'Arabic', 'Agriculture', 'Business & Entrepreneurial Studies', 'Pre-vocational Studies'
    ]::text[]),
    ('Junior Secondary', 'JSS 2', 'Core', array[
      'English Language', 'Mathematics', 'Intermediate Science', 'Digital Technologies',
      'Nigerian History', 'Social Studies', 'Citizenship & Values Education',
      'Cultural & Creative Arts', 'Physical & Health Education', 'Religious Studies',
      'Christian Religious Studies', 'Islamic Studies', 'Nigerian Language', 'French',
      'Arabic', 'Agriculture', 'Business & Entrepreneurial Studies', 'Pre-vocational Studies'
    ]::text[]),
    ('Junior Secondary', 'JSS 3', 'Core', array[
      'English Language', 'Mathematics', 'Intermediate Science', 'Digital Technologies',
      'Nigerian History', 'Social Studies', 'Citizenship & Values Education',
      'Cultural & Creative Arts', 'Physical & Health Education', 'Religious Studies',
      'Christian Religious Studies', 'Islamic Studies', 'Nigerian Language', 'French',
      'Arabic', 'Agriculture', 'Business & Entrepreneurial Studies', 'Pre-vocational Studies'
    ]::text[]),
    ('Senior Secondary', 'SSS 1', 'Core', array[
      'English Language', 'General Mathematics', 'Citizenship and Heritage Studies',
      'Digital Technologies', 'One Trade Subject'
    ]::text[]),
    ('Senior Secondary', 'SSS 2', 'Core', array[
      'English Language', 'General Mathematics', 'Citizenship and Heritage Studies',
      'Digital Technologies', 'One Trade Subject'
    ]::text[]),
    ('Senior Secondary', 'SSS 3', 'Core', array[
      'English Language', 'General Mathematics', 'Citizenship and Heritage Studies',
      'Digital Technologies', 'One Trade Subject'
    ]::text[]),
    ('Senior Secondary', 'SSS 1', 'Science', array[
      'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Further Mathematics',
      'Physical Education', 'Health Education', 'Foods & Nutrition', 'Geography', 'Technical Drawing'
    ]::text[]),
    ('Senior Secondary', 'SSS 2', 'Science', array[
      'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Further Mathematics',
      'Physical Education', 'Health Education', 'Foods & Nutrition', 'Geography', 'Technical Drawing'
    ]::text[]),
    ('Senior Secondary', 'SSS 3', 'Science', array[
      'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Further Mathematics',
      'Physical Education', 'Health Education', 'Foods & Nutrition', 'Geography', 'Technical Drawing'
    ]::text[]),
    ('Senior Secondary', 'SSS 1', 'Arts & Humanities', array[
      'Nigerian History', 'Government', 'Christian Religious Studies', 'Islamic Studies',
      'Nigerian Language', 'French', 'Arabic', 'Visual Arts', 'Music',
      'Literature-in-English', 'Home Management', 'Catering Craft'
    ]::text[]),
    ('Senior Secondary', 'SSS 2', 'Arts & Humanities', array[
      'Nigerian History', 'Government', 'Christian Religious Studies', 'Islamic Studies',
      'Nigerian Language', 'French', 'Arabic', 'Visual Arts', 'Music',
      'Literature-in-English', 'Home Management', 'Catering Craft'
    ]::text[]),
    ('Senior Secondary', 'SSS 3', 'Arts & Humanities', array[
      'Nigerian History', 'Government', 'Christian Religious Studies', 'Islamic Studies',
      'Nigerian Language', 'French', 'Arabic', 'Visual Arts', 'Music',
      'Literature-in-English', 'Home Management', 'Catering Craft'
    ]::text[]),
    ('Senior Secondary', 'SSS 1', 'Commercial & Business', array[
      'Accounting', 'Commerce', 'Marketing', 'Economics'
    ]::text[]),
    ('Senior Secondary', 'SSS 2', 'Commercial & Business', array[
      'Accounting', 'Commerce', 'Marketing', 'Economics'
    ]::text[]),
    ('Senior Secondary', 'SSS 3', 'Commercial & Business', array[
      'Accounting', 'Commerce', 'Marketing', 'Economics'
    ]::text[]),
    ('Senior Secondary', 'SSS 1', 'Trade', array[
      'Solar Photovoltaic Installation & Maintenance', 'Fashion Design & Garment Making',
      'Livestock Farming', 'Beauty & Cosmetology', 'Computer Hardware & GSM Repairs',
      'Horticulture & Crop Production'
    ]::text[]),
    ('Senior Secondary', 'SSS 2', 'Trade', array[
      'Solar Photovoltaic Installation & Maintenance', 'Fashion Design & Garment Making',
      'Livestock Farming', 'Beauty & Cosmetology', 'Computer Hardware & GSM Repairs',
      'Horticulture & Crop Production'
    ]::text[]),
    ('Senior Secondary', 'SSS 3', 'Trade', array[
      'Solar Photovoltaic Installation & Maintenance', 'Fashion Design & Garment Making',
      'Livestock Farming', 'Beauty & Cosmetology', 'Computer Hardware & GSM Repairs',
      'Horticulture & Crop Production'
    ]::text[])
)
insert into public.subjects (
  subject_name,
  subject_code,
  curriculum_band,
  curriculum_level,
  curriculum_track
)
select
  subject_name,
  'SUB-' || upper(substr(md5(concat_ws('|', curriculum_band, curriculum_level, curriculum_track, subject_name)), 1, 16)),
  curriculum_band,
  curriculum_level,
  curriculum_track
from curriculum
cross join lateral unnest(subject_names) as subject_name
on conflict do nothing;
