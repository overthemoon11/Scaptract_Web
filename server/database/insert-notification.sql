-- Insert notification for user about comment reply
-- For Supabase/PostgreSQL

INSERT INTO notifications (user_id, title, message, is_read)
VALUES (
    '0d02c4b2-1671-404f-8df4-0ba46e6977cb',
    'System Update',
    'Your comment has been replied',
    FALSE
);

-- Alternative with more detailed message:
-- INSERT INTO notifications (user_id, title, message, is_read)
-- VALUES (
--     '0d02c4b2-1671-404f-8df4-0ba46e6977cb',
--     'Comment Reply',
--     'System update: Your comment has been replied',
--     FALSE
-- );

