const Header = () => {
    return (
        <header className="flex items-center justify-between w-full">
            <h1 className="text-3xl font-bold my-6 w-full flex items-center gap-2">
                Cover Maker
            </h1>
            <a
                href={'https://github.com/KartoffelChipss/Jellyfin-Cover-Maker'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className="btn-link text-muted-foreground text-sm whitespace-nowrap"
            >
                Based on Jellyfin Cover Maker
            </a>
        </header>
    );
};

export default Header;
