import { type Prisma } from '@prisma/client';
import { franc } from 'franc';
import { type NextApiResponse } from 'next';

import earncognitoClient from '@/lib/earncognitoClient';
import logger from '@/lib/logger';
import { prisma } from '@/prisma';
import { cleanSkills } from '@/utils/cleanSkills';
import { safeStringify } from '@/utils/safeStringify';

import { type NextApiRequestWithSponsor } from '@/features/auth/types';
import { checkListingSponsorAuth } from '@/features/auth/utils/checkListingSponsorAuth';
import { withSponsorAuth } from '@/features/auth/utils/withSponsorAuth';
import { fetchSlugCheck } from '@/features/listing-builder/queries/slug-check';
import { type ListingFormData } from '@/features/listing-builder/types';

import { generateUniqueSlug } from './check-slug';

async function handler(req: NextApiRequestWithSponsor, res: NextApiResponse) {
  try {
    const userId = req.userId;
    const userSponsorId = req.userSponsorId;

    if (!userId) {
      logger.warn('Invalid token: User Id is missing');
      return res.status(400).json({ error: 'Invalid token' });
    }

    if (!userSponsorId) {
      logger.warn('Invalid token: User Sponsor Id is missing');
      return res.status(400).json({ error: 'Invalid token' });
    }

    logger.debug(`Request body: ${safeStringify(req.body)}`);

    const {
      id,
      title,
      slug,
      deadline,
      commitmentDate,
      templateId,
      pocSocials,
      description,
      type,
      region,
      eligibility,
      rewardAmount,
      rewards,
      maxBonusSpots,
      token,
      compensationType,
      minRewardAsk,
      maxRewardAsk,
      isPrivate,
      skills,
      isFndnPaying,
      hackathonId,
      referredBy,
    } = req.body as Partial<ListingFormData>;

    const { error, listing } = id
      ? await checkListingSponsorAuth(userSponsorId, id as string)
      : { error: undefined };
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    if (listing?.isPublished === true) {
      logger.warn('Published Listings are not allowed to be draft');
      return res.status(403).send({
        error: 'Not Allowed',
        message: 'Published Listings are not allowed to be draft',
      });
    }
    if (
      listing &&
      listing?.status !== 'OPEN' &&
      listing?.status !== 'VERIFYING'
    ) {
      logger.warn(
        `Listing has status ${listing.status}, hence not allowed to edit`,
      );
      return res.status(403).send({
        error: 'Not Allowed',
        message: `Listing has status ${listing.status}, hence not allowed to edit`,
      });
    }

    const language = description ? franc(description) : 'eng';

    const cleanedSkills = skills ? cleanSkills(skills) : undefined;

    const reTitle = title || 'Untitled Draft';
    let reSlug = slug;
    if (reSlug && id && reSlug !== listing?.slug) {
      try {
        await fetchSlugCheck({
          slug: reSlug,
          id: id || undefined,
          check: true,
        });
      } catch (error) {
        logger.warn(
          'Save draft - already used slug passed, using prev slug',
          error,
        );
        reSlug = listing?.slug;
      }
    }
    const uniqueSlug = id
      ? reSlug
      : reSlug
        ? await generateUniqueSlug(reSlug)
        : await generateUniqueSlug(reTitle);
    const data: Prisma.BountiesUncheckedCreateInput = {
      title: reTitle,
      slug: uniqueSlug || `untitled-draft-${Date.now()}`,
      description,
      deadline: deadline ? new Date(deadline) : undefined,
      commitmentDate: commitmentDate ? new Date(commitmentDate) : undefined,
      pocSocials,
      templateId,
      type,
      region,
      eligibility: eligibility as Prisma.InputJsonValue,
      rewardAmount,
      rewards: rewards as Prisma.InputJsonValue,
      maxBonusSpots:
        maxBonusSpots === undefined ? undefined : maxBonusSpots || 0,
      token,
      compensationType,
      minRewardAsk,
      maxRewardAsk,
      isPrivate,
      skills: cleanedSkills as Prisma.InputJsonValue,
      language,
      sponsorId: userSponsorId,
      isFndnPaying,
      hackathonId,
      referredBy,
      ...(!listing
        ? {
            pocId: userId,
          }
        : {
            pocId: listing.pocId,
          }),
    };

    const result = id
      ? await prisma.bounties.update({
          where: { id },
          data,
        })
      : await prisma.bounties.create({
          data,
        });

    logger.debug(`Draft saved successfully: ${result.id}`);

    if (result.status === 'VERIFYING') {
      try {
        logger.info('Updating Discord Verification message', {
          id,
        });
        await earncognitoClient.post(`/discord/verify-listing/initiate`, {
          listingId: result.id,
        });
        logger.info('Updated Discord Verification message', {
          id,
        });
      } catch (err) {
        logger.error('Failed to update Verification Message to discord', err);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.log('error', error);
    logger.error('Error saving draft:', error);
    return res.status(500).json({ error: 'Failed to save draft' });
  }
}

export default withSponsorAuth(handler);
