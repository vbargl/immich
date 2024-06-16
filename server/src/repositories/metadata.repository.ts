import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DefaultReadTaskOptions, Tags, exiftool } from 'exiftool-vendored';
import geotz from 'geo-tz';
import { DummyValue, GenerateSql } from 'src/decorators';
import { ExifEntity } from 'src/entities/exif.entity';
import { GeodataPlacesEntity } from 'src/entities/geodata-places.entity';
import { ILoggerRepository } from 'src/interfaces/logger.interface';
import { IMetadataRepository, ImmichTags } from 'src/interfaces/metadata.interface';
import { Instrumentation } from 'src/utils/instrumentation';
import { DataSource, Repository } from 'typeorm';

@Instrumentation()
@Injectable()
export class MetadataRepository implements IMetadataRepository {
  constructor(
    @InjectRepository(ExifEntity) private exifRepository: Repository<ExifEntity>,
    @InjectRepository(GeodataPlacesEntity) private geodataPlacesRepository: Repository<GeodataPlacesEntity>,
    @InjectDataSource() private dataSource: DataSource,
    @Inject(ILoggerRepository) private logger: ILoggerRepository,
  ) {
    this.logger.setContext(MetadataRepository.name);
  }

  async teardown() {
    await exiftool.end();
  }

  readTags(path: string): Promise<ImmichTags | null> {
    return exiftool
      .read(path, undefined, {
        ...DefaultReadTaskOptions,

        // Enable exiftool LFS to parse metadata for files larger than 2GB.
        optionalArgs: ['-api', 'largefilesupport=1'],
        defaultVideosToUTC: true,
        backfillTimezones: true,
        inferTimezoneFromDatestamps: true,
        useMWG: true,
        numericTags: [...DefaultReadTaskOptions.numericTags, 'FocalLength'],
        /* eslint unicorn/no-array-callback-reference: off, unicorn/no-array-method-this-argument: off */
        geoTz: (lat, lon) => geotz.find(lat, lon)[0],
      })
      .catch((error) => {
        this.logger.warn(`Error reading exif data (${path}): ${error}`, error?.stack);
        return null;
      }) as Promise<ImmichTags | null>;
  }

  extractBinaryTag(path: string, tagName: string): Promise<Buffer> {
    return exiftool.extractBinaryTagToBuffer(tagName, path);
  }

  async writeTags(path: string, tags: Partial<Tags>): Promise<void> {
    try {
      await exiftool.write(path, tags, ['-overwrite_original']);
    } catch (error) {
      this.logger.warn(`Error writing exif data (${path}): ${error}`);
    }
  }

  @GenerateSql({ params: [DummyValue.UUID] })
  async getCountries(userId: string): Promise<string[]> {
    const entity = await this.exifRepository
      .createQueryBuilder('exif')
      .leftJoin('exif.asset', 'asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('exif.country IS NOT NULL')
      .select('exif.country')
      .distinctOn(['exif.country'])
      .getMany();

    return entity.map((e) => e.country ?? '').filter((c) => c !== '');
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING] })
  async getStates(userId: string, country: string | undefined): Promise<string[]> {
    let result: ExifEntity[] = [];

    const query = this.exifRepository
      .createQueryBuilder('exif')
      .leftJoin('exif.asset', 'asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('exif.state IS NOT NULL')
      .select('exif.state')
      .distinctOn(['exif.state']);

    if (country) {
      query.andWhere('exif.country = :country', { country });
    }

    result = await query.getMany();

    return result.map((entity) => entity.state ?? '').filter((s) => s !== '');
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING, DummyValue.STRING] })
  async getCities(userId: string, country: string | undefined, state: string | undefined): Promise<string[]> {
    let result: ExifEntity[] = [];

    const query = this.exifRepository
      .createQueryBuilder('exif')
      .leftJoin('exif.asset', 'asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('exif.city IS NOT NULL')
      .select('exif.city')
      .distinctOn(['exif.city']);

    if (country) {
      query.andWhere('exif.country = :country', { country });
    }

    if (state) {
      query.andWhere('exif.state = :state', { state });
    }

    result = await query.getMany();

    return result.map((entity) => entity.city ?? '').filter((c) => c !== '');
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING] })
  async getCameraMakes(userId: string, model: string | undefined): Promise<string[]> {
    let result: ExifEntity[] = [];

    const query = this.exifRepository
      .createQueryBuilder('exif')
      .leftJoin('exif.asset', 'asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('exif.make IS NOT NULL')
      .select('exif.make')
      .distinctOn(['exif.make']);

    if (model) {
      query.andWhere('exif.model = :model', { model });
    }

    result = await query.getMany();

    return result.map((entity) => entity.make ?? '').filter((m) => m !== '');
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING] })
  async getCameraModels(userId: string, make: string | undefined): Promise<string[]> {
    let result: ExifEntity[] = [];

    const query = this.exifRepository
      .createQueryBuilder('exif')
      .leftJoin('exif.asset', 'asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere('exif.model IS NOT NULL')
      .select('exif.model')
      .distinctOn(['exif.model']);

    if (make) {
      query.andWhere('exif.make = :make', { make });
    }

    result = await query.getMany();

    return result.map((entity) => entity.model ?? '').filter((m) => m !== '');
  }
}
