DELETE FROM admins WHERE email = 'admin@verbumdigital.com';

INSERT INTO
    admins (
        username,
        email,
        password_hash
    )
VALUES (
        'admin',
        'admin@verbumdigital.com',
        '$2a$10$JWGADUJsqmgh0rNEyMZ5tuCmyy1O/13.bLrdlUpk4EPVWRDccE.j.'
    );