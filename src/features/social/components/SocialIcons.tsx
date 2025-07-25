import Link from 'next/link';
import React from 'react';

import FaDiscord from '@/components/icons/FaDiscord';
import FaGithub from '@/components/icons/FaGithub';
import FaGlobe from '@/components/icons/FaGlobe';
import FaLinkedin from '@/components/icons/FaLinkedin';
import FaTelegram from '@/components/icons/FaTelegram';
import FaXTwitter from '@/components/icons/FaXTwitter';
import { type IconType } from '@/components/icons/helpers/GenIcon';
import { cn } from '@/utils/cn';
import { getURLSanitized } from '@/utils/getURLSanitized';

interface SocialIconProps extends React.ComponentPropsWithoutRef<'svg'> {
  link?: string;
  as?: IconType;
  size?: string | number;
  className?: string;
}

const SocialIcon = ({
  link,
  as: Icon,
  size = '1em',
  className,
  ...props
}: SocialIconProps) => {
  if (!Icon) return null;

  const iconElement = (
    <Icon
      size={size}
      className={cn(
        'transition-opacity duration-200',
        !link && 'opacity-20 grayscale',
        link && 'cursor-pointer opacity-100 hover:opacity-80',
        className,
      )}
      {...props}
    />
  );

  if (!link) {
    return (
      <div className="flex" role="presentation">
        {iconElement}
      </div>
    );
  }

  return (
    <Link
      href={getURLSanitized(link)}
      rel="noopener noreferrer"
      target="_blank"
      className="flex"
      tabIndex={0}
    >
      {iconElement}
    </Link>
  );
};

interface IndividualSocialIconProps extends Omit<SocialIconProps, 'as'> {
  link?: string;
}

const Twitter = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaXTwitter} link={link} {...props} />
);

const Telegram = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaTelegram} link={link} {...props} />
);

const Linkedin = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaLinkedin} link={link} {...props} />
);

const Website = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaGlobe} link={link} {...props} />
);

const Discord = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaDiscord} link={link} {...props} />
);

const GitHub = ({ link, ...props }: IndividualSocialIconProps) => (
  <SocialIcon as={FaGithub} link={link} {...props} />
);

export { Discord, GitHub, Linkedin, Telegram, Twitter, Website };
