import { faker } from "@faker-js/faker";
import { isoDateFromDateTime } from "../lib/dateTime.js";
import {
  endOfYear,
  generateRandomDates,
  ONE_DAY,
  startOfDay,
  toPairs,
} from "../lib/mocks.js";
import { AbsenceStatus, AbsenceType, Absence, SickAbsence } from "./absence.js";

const DEFAULT_FROM = new Date(2020, 0);
const DEFAULT_TO = new Date(2021, 0);

const absenceStatuses = Object.values(AbsenceStatus).filter(
  (status): status is AbsenceStatus => typeof status === "number"
);
const absenceTypesWithoutOvertimeReduction = Object.values(AbsenceType).filter(
  (
    status
  ): status is Exclude<
    AbsenceType,
    | AbsenceType.ReductionOfOvertime
    | AbsenceType.SickDay
    | AbsenceType.SickDayOfChild
  > =>
    typeof status === "number" &&
    status !== AbsenceType.ReductionOfOvertime &&
    status !== AbsenceType.SickDay &&
    status !== AbsenceType.SickDayOfChild
);

export const createAbsenceMocks = ({
  count = 1,
  dateSinceBetween: [from, to] = [DEFAULT_FROM, DEFAULT_TO],
}: { count?: number; dateSinceBetween?: readonly [Date, Date] } = {}) => {
  const dayPairs = toPairs(
    generateRandomDates({
      count: count * 2,
      between: [from, to],
      maxDuplicates: 2,
    })
  );

  return dayPairs.map(([from, to], index): Absence => {
    const isOvertimeReduction = faker.datatype.boolean(0.2);
    const isSick = !isOvertimeReduction && faker.datatype.boolean(0.2);
    const isHalfDay = !isOvertimeReduction && faker.datatype.boolean(0.4);
    const hasNote = faker.datatype.boolean(0.2);
    const absencesId = index;

    const dateSince = startOfDay(
      faker.date.between({
        from,
        to,
      })
    );

    const dateUntil = isHalfDay
      ? dateSince
      : new Date(
          Math.min(
            to,
            // Make sure that we don't get absences that are too long
            dateSince.getTime() +
              faker.number.int({ min: 0, max: 30 }) * ONE_DAY,
            // Clockodo makes sure that dateSince and dateUntil are always within the same year
            endOfYear(dateSince).getTime()
          )
        );

    const status = faker.datatype.boolean(0.4)
      ? AbsenceStatus.Approved
      : faker.helpers.arrayElement(absenceStatuses);

    const dateEnquiredDateTime = new Date(
      dateSince.getTime() - faker.number.int({ min: 5, max: 200 }) * ONE_DAY
    );

    const commonAbsence = {
      id: absencesId,
      usersId: 0,
      dateSince: isoDateFromDateTime(dateSince),
      dateUntil: isoDateFromDateTime(dateUntil),
      status,
      note: hasNote
        ? faker.lorem.words(faker.number.int({ min: 2, max: 10 }))
        : null,
      dateEnquired: faker.datatype.boolean(0.6)
        ? null
        : isoDateFromDateTime(dateEnquiredDateTime),
      dateApproved:
        status === AbsenceStatus.Approved
          ? isoDateFromDateTime(
              new Date(
                dateEnquiredDateTime.getTime() +
                  faker.number.int({ min: 0, max: 4 }) * ONE_DAY
              )
            )
          : null,
      approvedBy: status === AbsenceStatus.Approved ? 1 : null,
    };

    if (isOvertimeReduction) {
      return {
        ...commonAbsence,
        type: AbsenceType.ReductionOfOvertime,
        countDays: null,
        countHours: faker.number.float({ min: 0.1, max: 8 }),
      };
    }

    const commonNonOvertimeReduction = {
      ...commonAbsence,
      countDays: isHalfDay
        ? 0.5
        : Math.max(
            (dateUntil.getTime() - dateSince.getTime()) / ONE_DAY -
              faker.number.int({ min: 0, max: 3 }),
            1
          ),
      countHours: null,
    };

    if (isSick) {
      return {
        ...commonAbsence,
        type: faker.datatype.boolean(0.5)
          ? AbsenceType.SickDay
          : AbsenceType.SickDayOfChild,
        sickNote: faker.datatype.boolean(0.5),
      } as unknown as SickAbsence;
    }

    return {
      ...commonNonOvertimeReduction,
      // Make sure that we get the most important absence types
      // also for lower mock counts.
      type: absenceTypesWithoutOvertimeReduction[
        index % absenceTypesWithoutOvertimeReduction.length
      ],
    };
  });
};
