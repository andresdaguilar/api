const cheerio = require('cheerio');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const drive = google.drive('v3');
const azure = require('azure-storage');
const fileService = azure.createFileService();
const blobService = azure.createBlobService();
const mime = require('mime');
const Promise = require("bluebird");
const streamBuffers = require('stream-buffers');
import Jimp from 'jimp';


const createContainerIfNotExists = Promise.promisify(blobService.createContainerIfNotExists).bind(blobService);
const createAppendBlobFromText = Promise.promisify(blobService.createAppendBlobFromText).bind(blobService);
const getBlobMetadata = Promise.promisify(blobService.getBlobMetadata).bind(blobService);

function retrieveAllFiles(auth, folder) {
    return new Promise((resolve, reject) => {
        var result = []
        var retrievePageOfFiles = function (err, resp) {
            console.log(resp.files)
            result = result.concat(resp.files);
            var nextPageToken = resp.nextPageToken;
            if (nextPageToken) {
                request = drive.files.list({
                    auth: auth,
                    'pageToken': nextPageToken
                }, retrievePageOfFiles);
            } else {
                resolve(result);
            }
        }

        var initialRequest = drive.files.list({
            auth: auth,
            'q': `'${folder}' in parents`
        }, retrievePageOfFiles);
    });

}



function exportFile(auth, fileId) {
    return new Promise((resolve, reject) => {

        drive.files.export({
            auth,
            fileId,
            mimeType: "text/html"
        }, (e2, r2) => {
            const $ = cheerio.load(r2);

            // Transforming styles to full HTML elements
            $('[style]').each((i, e) => {
                const weight = $(e).css('font-weight');
                const textDecoration = $(e).css('text-decoration');
                const fontStyle = $(e).css('font-style');
                const verticalAlign = $(e).css('vertical-align');

                let pa = null;
                let ch = null;
                const wrap = (t) => {
                    let ch1 = $(t)
                    if (pa) {
                        if (ch) {
                            ch.append(ch1);
                        }
                        ch = ch1;
                    } else {
                        pa = ch1;
                        ch = ch1;
                    }
                }

                if (weight > 400) {
                    wrap('<strong />');
                }
                if (textDecoration == 'underline') {
                    wrap('<u />');
                }
                if (fontStyle == 'italic') {
                    wrap('<em />');
                }
                if (verticalAlign == 'super') {
                    wrap('<sup />');
                }
                if (verticalAlign == 'sub') {
                    wrap('<sub />');
                }

                if (pa && ch) {
                    let { parent, children } = e;
                    let c = $(children).clone();

                    ch.append(children);
                    $(e).replaceWith(pa);
                }
            });

            // passing images through filters
            let a = $('img').map((i, o) => {
                let src = o.attribs.src;
                return { src, obj: $(o) };
            });
            let promises = _.map(a, (i) => {
                return new Promise((_resolve, _reject) => {
                    Jimp.read(i.src, function (err, image) {
                        if (err) throw err;

                        let width = image.bitmap.width;
                        if (width > 700) {
                            width = 700;
                            let ratio = image.bitmap.width / image.bitmap.height;
                            let height = width * ratio;
                            image = image.scaleToFit(width, height);
                        }

                        if ((image.bitmap.width / image.bitmap.height) < Math.sqrt(5)) {
                            image = image.crop(0, 0, image.bitmap.width, image.bitmap.width / Math.sqrt(5));
                        } else {
                            image = image.scaleToFit(image.bitmap.width, image.bitmap.width / Math.sqrt(5));
                        }

                        image
                            //.resize(256, 256)            // resize
                            .quality(50)                 // set JPEG quality
                            .getBuffer('image/jpeg', (a, b) => {
                                let hash = image.hash();

                                createContainerIfNotExists('ri-images')
                                    .then((d) => {
                                        return createAppendBlobFromText('ri-images', `${hash}.jpg`, b, b.length);
                                    })
                                    .then((f) => {
                                        return getBlobMetadata('ri-images', `${hash}.jpg`);
                                    }).then((m) => {
                                        _resolve({
                                            newSrc: blobService.getUrl('ri-images', m.name),
                                            ...i
                                        });
                                    })
                            }); // save
                    });
                })
            });


            // Removing unnecessary spans
            $('* > span').each((i, e) => {
                let { parent, children } = e;
                let c = $(children).clone();
                $(e).replaceWith(c);
            });

            // Removing formatting from everything but images
            $('[style]:not(img)').each((i, e) => {
                delete e.attribs['id'];
                delete e.attribs['style'];
                delete e.attribs['name'];
            });

            // Removing formatting from images
            $('img').each((i, e) => e.attribs = { src: e.attribs.src, alt: e.attribs.alt });

            // Removing empty spans, ps and divs
            $('p > span:empty').remove();
            $('p:empty').remove();
            $('div:empty').remove();
            $('sup:empty').remove();
            $('sub:empty').remove();
            $('em:empty').remove();
            $('u:empty').remove();

            // Removing GDocs Comments
            $('div p a[id]').parent().parent().remove();
            $('sup a[id]').remove();

            $('p em').each((i, e) => {
                if ($(e).parent().prev().has('img')) {
                    $(e).addClass('caption');
                }
            })


            Promise.all(promises).then((p) => {

                p.forEach((v) => {
                    $(`[src='${v.src}']`).attr('src', v.newSrc);
                })
                resolve($('body').html());
            });
        });
    });
}

function listFiles(auth, oid) {
    return new Promise((resolve, reject) => {
        //const folder = "0B-lKSEVt5tJeamY2d3ZBRlJEMXc";
        //const folder = "0B-lKSEVt5tJeTVJ3WW1RSVFGaUU";
        const folder = "0B-lKSEVt5tJebk1aM3B6N1pJQjQ";

        var initialRequest = drive.files.list({
            auth: auth,
            'q': `'${folder}' in parents`
        }, (e, r) => {
            ;
            const { files } = r;
            const fileId = files[0].id;
            oid = oid || files[0].id;

            console.log(fileId);

            resolve(oid);
        });
    }).then(o => exportFile(auth, o));
}

const root = path.dirname(path.join(__dirname, '..'));
const secrets = path.join(root, 'secrets.json');

function loadKey() {
    return new Promise((res, rej) => {
        if (process.env.GOOGLE_SECRETS) {
            var key = JSON.parse(process.env.GOOGLE_SECRETS);
            var jwtClient = new google.auth.JWT(
                key.client_email,
                null,
                key.private_key,
                SCOPES,
                null
            );

            jwtClient.authorize(function (err, tokens) {
                if (err) {
                    console.log(err);

                    rej(err);

                }
                res(jwtClient);

            });
        } else {
            fs.readFile(secrets, (err, content) => {
                if (err) {
                    console.log('Error loading client secret file: ' + err);
                    rej(err);
                }

                var key = JSON.parse(content);
                var jwtClient = new google.auth.JWT(
                    key.client_email,
                    null,
                    key.private_key,
                    SCOPES,
                    null
                );

                jwtClient.authorize(function (err, tokens) {
                    if (err) {
                        console.log(err);

                        rej(err);

                    }
                    res(jwtClient);
                });
            });
        }
    });
}

export default {
    utils: {
        generateDocument: (id) => {
            return loadKey()
                .then((auth) => exportFile(auth, id).then((h) => {
                    const $ = cheerio.load(h);
                    const title = $('.title').remove();
                    const subtitle = $('.subtitle').remove();
                    const hero = $('img', subtitle).remove();
                    return {
                        title: title.html(),
                        lede: subtitle.html(),
                        hero: hero.attr('src'),
                        body: $('body').html()
                    }
                }));
        }
    },
    driveService: {
        find: (params) => {
            return loadKey()
                .then((k) => retrieveAllFiles(k, "0B-lKSEVt5tJeamY2d3ZBRlJEMXc"));
        },
        get: (id, params) => {
            return loadKey()
                .then((k) => exportFile(k, id));
        }
    }
};

