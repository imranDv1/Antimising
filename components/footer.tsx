import { Logo } from '@/components/logo'
import Link from 'next/link'

type FooterLink = { title: string; href: string; external?: boolean };
type LinkGroup = { group: string; items: FooterLink[] };

const links: LinkGroup[] = [
    {
        group: 'Product',
        items: [
            {
                title: 'Features',
                href: '/#features',
            },
            {
                title: 'Solution',
                href: '/#solution',
            },
            {
                title: 'Pricing',
                href: '/#pricing',
            },
            {
                title: 'Notes',
                href: '/dashboard/create',
            },
        ],
    },
    {
        group: 'App',
        items: [
            {
                title: 'All Notes',
                href: '/dashboard/create',
            },
            {
                title: 'Password Manager',
                href: '/dashboard/passwords',
            },
            {
                title: 'Canvas',
                href: '/dashboard/canvas',
            },
            {
                title: 'Shared Notes',
                href: '/dashboard/shared',
            },
            {
                title: 'Favorites',
                href: '/dashboard/favorites',
            },
        ],
    },
    {
        group: 'Company',
        items: [
            {
                title: 'Dashboard',
                href: '/dashboard',
            },
            {
                title: 'Settings',
                href: '/dashboard/setting',
            },
            {
                title: 'Profile',
                href: '/dashboard/profile',
            },
            {
                title: 'About',
                href: '/',
            },
        ],
    },
    {
        group: 'Get Started',
        items: [
            {
                title: 'Sign Up',
                href: '/signUp',
            },
            {
                title: 'Login',
                href: '/login',
            },
            {
                title: 'Forgot Password',
                href: '/forgot-password',
            },
            {
                title: 'Contact',
                href: 'https://x.com/imrandv1',
                external: true,
            },
        ],
    },
]

export default function FooterSection() {
    return (
        <footer className="border-t bg-white pt-20 dark:bg-[#111]">
            <div className="mx-auto max-w-5xl px-6">
                <div className="grid gap-12 md:grid-cols-5">
                    <div className="md:col-span-2">
                        <Link
                            href="/"
                            aria-label="go home"
                            className=" size-fit flex items-center gap-3">
                            <Logo />
                            <h1>AntiMising</h1>
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:col-span-3">
                        {links.map((link, index) => (
                            <div
                                key={index}
                                className="space-y-4 text-sm">
                                <span className="block font-medium">{link.group}</span>
                                {link.items.map((item, index) => (
                                    <Link
                                        key={index}
                                        href={item.href}
                                        target={item.external ? "_blank" : undefined}
                                        rel={item.external ? "noopener noreferrer" : undefined}
                                        className="text-muted-foreground hover:text-primary block duration-150">
                                        <span>{item.title}</span>
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t py-6">
                    <span className="text-muted-foreground order-last block text-center text-sm md:order-first">© {new Date().getFullYear()} AntiMising, All rights reserved</span>
                    <div className="order-first flex flex-wrap justify-center gap-6 text-sm md:order-last">
                        <Link
                            href="https://x.com/imrandv1"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="X/Twitter"
                            className="text-muted-foreground hover:text-primary block">
                            <svg
                                className="size-6"
                                xmlns="http://www.w3.org/2000/svg"
                                width="1em"
                                height="1em"
                                viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M10.488 14.651L15.25 21h7l-7.858-10.478L20.93 3h-2.65l-5.117 5.886L8.75 3h-7l7.51 10.015L2.32 21h2.65zM16.25 19L5.75 5h2l10.5 14z"></path>
                            </svg>
                        </Link>
                        <Link
                            href="https://github.com/imranDv1/Rivorea-notes"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            className="text-muted-foreground hover:text-primary block">
                            <svg
                                className="size-6"
                                xmlns="http://www.w3.org/2000/svg"
                                width="1em"
                                height="1em"
                                viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
