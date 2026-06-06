-- Create categories table for Supabase

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Example default categories
INSERT INTO categories (name, slug, description)
VALUES
    ('Personalized Gifts', 'personalized-gifts', 'Custom gifts with names, photos, or messages.'),
    ('Premium Keychains', 'premium-keychains', 'Luxury keychain designs for every occasion.'),
    ('3D Printed Masterpieces', '3d-printed-masterpieces', 'High-quality 3D printed gift items.'),
    ('Elegant Photo Frames', 'elegant-photo-frames', 'Stylish frames to showcase your memories.')
ON CONFLICT (slug) DO NOTHING;
